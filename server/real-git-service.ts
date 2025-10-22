import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { File } from '@shared/schema';

const execFileAsync = promisify(execFile);

export interface GitFileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'untracked';
}

export interface GitCommitInfo {
  hash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  filesChanged: GitFileChange[];
}

export interface GitStatusResult {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: string[];
}

export class RealGitService {
  private projectsBasePath: string;

  constructor(basePath: string = 'project-repos') {
    this.projectsBasePath = basePath;
  }

  private getProjectRepoPath(projectId: string): string {
    return join(this.projectsBasePath, projectId);
  }

  private async execGit(projectId: string, args: string[]): Promise<string> {
    const repoPath = this.getProjectRepoPath(projectId);
    
    try {
      const { stdout } = await execFileAsync('git', args, {
        cwd: repoPath,
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 'Android Studio Web',
          GIT_COMMITTER_NAME: 'Android Studio Web',
        },
      });
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`Git command failed: ${error.message}`);
    }
  }

  async initializeRepository(projectId: string, files: File[]): Promise<void> {
    const repoPath = this.getProjectRepoPath(projectId);

    if (existsSync(repoPath)) {
      await rm(repoPath, { recursive: true, force: true });
    }

    await mkdir(repoPath, { recursive: true });

    await execFileAsync('git', ['init'], { cwd: repoPath });
    await execFileAsync('git', ['config', 'user.email', 'android-studio@web.app'], { cwd: repoPath });
    await execFileAsync('git', ['config', 'user.name', 'Android Studio Web'], { cwd: repoPath });

    for (const file of files) {
      if (file.type === 'file') {
        const filePath = join(repoPath, file.path);
        const dir = join(filePath, '..');
        await mkdir(dir, { recursive: true });
        await writeFile(filePath, file.content, 'utf-8');
      }
    }

    await execFileAsync('git', ['add', '.'], { cwd: repoPath });
    await execFileAsync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath });
  }

  async syncFiles(projectId: string, files: File[]): Promise<void> {
    const repoPath = this.getProjectRepoPath(projectId);

    if (!existsSync(repoPath)) {
      await this.initializeRepository(projectId, files);
      return;
    }

    for (const file of files) {
      if (file.type === 'file') {
        const filePath = join(repoPath, file.path);
        const dir = join(filePath, '..');
        await mkdir(dir, { recursive: true });
        await writeFile(filePath, file.content, 'utf-8');
      }
    }
  }

  async getStatus(projectId: string): Promise<GitStatusResult> {
    const repoPath = this.getProjectRepoPath(projectId);

    if (!existsSync(repoPath)) {
      throw new Error('Repository not initialized');
    }

    const branchOutput = await this.execGit(projectId, ['branch', '--show-current']);
    const branch = branchOutput || 'main';

    const statusOutput = await this.execGit(projectId, ['status', '--porcelain']);
    
    const staged: GitFileChange[] = [];
    const unstaged: GitFileChange[] = [];
    const untracked: string[] = [];

    const lines = statusOutput.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const status1 = line[0];
      const status2 = line[1];
      const filePath = line.substring(3);

      if (status1 === '?' && status2 === '?') {
        untracked.push(filePath);
      } else {
        if (status1 !== ' ') {
          let fileStatus: GitFileChange['status'] = 'modified';
          if (status1 === 'A') fileStatus = 'added';
          else if (status1 === 'D') fileStatus = 'deleted';
          else if (status1 === 'M') fileStatus = 'modified';
          
          staged.push({ path: filePath, status: fileStatus });
        }
        
        if (status2 !== ' ') {
          let fileStatus: GitFileChange['status'] = 'modified';
          if (status2 === 'M') fileStatus = 'modified';
          else if (status2 === 'D') fileStatus = 'deleted';
          
          unstaged.push({ path: filePath, status: fileStatus });
        }
      }
    }

    return {
      branch,
      ahead: 0,
      behind: 0,
      staged,
      unstaged,
      untracked,
    };
  }

  async commit(
    projectId: string,
    message: string,
    author: string,
    email?: string
  ): Promise<GitCommitInfo> {
    const repoPath = this.getProjectRepoPath(projectId);

    if (!existsSync(repoPath)) {
      throw new Error('Repository not initialized');
    }

    await this.execGit(projectId, ['add', '-A']);

    const authorEmail = email || 'user@android-studio-web.app';
    const authorStr = `${author} <${authorEmail}>`;

    await this.execGit(projectId, ['commit', '-m', message, `--author=${authorStr}`]);

    const hash = await this.execGit(projectId, ['rev-parse', 'HEAD']);
    const showOutput = await this.execGit(projectId, ['show', '--name-status', '--format=%an%n%ae%n%ci', hash]);
    
    const lines = showOutput.split('\n');
    const commitAuthor = lines[0];
    const commitEmail = lines[1];
    const commitDate = new Date(lines[2]);

    const filesChanged: GitFileChange[] = [];
    for (let i = 4; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split('\t');
      if (parts.length === 2) {
        const status = parts[0];
        const path = parts[1];
        
        let fileStatus: GitFileChange['status'] = 'modified';
        if (status === 'A') fileStatus = 'added';
        else if (status === 'D') fileStatus = 'deleted';
        else if (status === 'M') fileStatus = 'modified';
        
        filesChanged.push({ path, status: fileStatus });
      }
    }

    return {
      hash,
      author: commitAuthor,
      email: commitEmail,
      date: commitDate,
      message,
      filesChanged,
    };
  }

  async getCommitHistory(projectId: string, branch?: string, limit: number = 50): Promise<GitCommitInfo[]> {
    const repoPath = this.getProjectRepoPath(projectId);

    if (!existsSync(repoPath)) {
      return [];
    }

    try {
      const branchArg = branch || 'HEAD';
      const logOutput = await this.execGit(projectId, [
        'log',
        branchArg,
        `--max-count=${limit}`,
        '--format=%H%n%an%n%ae%n%ci%n%s%n--END--',
      ]);

      const commits: GitCommitInfo[] = [];
      const commitBlocks = logOutput.split('--END--\n').filter(block => block.trim());

      for (const block of commitBlocks) {
        const lines = block.trim().split('\n');
        if (lines.length < 5) continue;

        const hash = lines[0];
        const author = lines[1];
        const email = lines[2];
        const date = new Date(lines[3]);
        const message = lines[4];

        const filesOutput = await this.execGit(projectId, ['show', '--name-status', '--format=', hash]);
        const filesChanged: GitFileChange[] = [];
        
        const fileLines = filesOutput.split('\n').filter(line => line.trim());
        for (const line of fileLines) {
          const parts = line.split('\t');
          if (parts.length === 2) {
            const status = parts[0];
            const path = parts[1];
            
            let fileStatus: GitFileChange['status'] = 'modified';
            if (status === 'A') fileStatus = 'added';
            else if (status === 'D') fileStatus = 'deleted';
            else if (status === 'M') fileStatus = 'modified';
            
            filesChanged.push({ path, status: fileStatus });
          }
        }

        commits.push({
          hash,
          author,
          email,
          date,
          message,
          filesChanged,
        });
      }

      return commits;
    } catch (error) {
      return [];
    }
  }

  async getBranches(projectId: string): Promise<string[]> {
    const repoPath = this.getProjectRepoPath(projectId);

    if (!existsSync(repoPath)) {
      return ['main'];
    }

    try {
      const branchesOutput = await this.execGit(projectId, ['branch', '--format=%(refname:short)']);
      return branchesOutput.split('\n').filter(b => b.trim());
    } catch (error) {
      return ['main'];
    }
  }

  async createBranch(projectId: string, branchName: string): Promise<void> {
    await this.execGit(projectId, ['branch', branchName]);
  }

  async checkoutBranch(projectId: string, branchName: string): Promise<void> {
    await this.execGit(projectId, ['checkout', branchName]);
  }

  async deleteBranch(projectId: string, branchName: string): Promise<void> {
    if (branchName === 'main' || branchName === 'master') {
      throw new Error('Cannot delete main branch');
    }
    await this.execGit(projectId, ['branch', '-D', branchName]);
  }

  async getDiff(projectId: string, filePath?: string): Promise<string> {
    const repoPath = this.getProjectRepoPath(projectId);

    if (!existsSync(repoPath)) {
      throw new Error('Repository not initialized');
    }

    const args = ['diff'];
    if (filePath) {
      args.push('--', filePath);
    }

    return await this.execGit(projectId, args);
  }

  async getFileDiff(projectId: string, commitHash: string, filePath: string): Promise<string> {
    return await this.execGit(projectId, ['show', `${commitHash}:${filePath}`]);
  }

  async getCurrentBranch(projectId: string): Promise<string> {
    const repoPath = this.getProjectRepoPath(projectId);

    if (!existsSync(repoPath)) {
      return 'main';
    }

    try {
      const branch = await this.execGit(projectId, ['branch', '--show-current']);
      return branch || 'main';
    } catch (error) {
      return 'main';
    }
  }

  async hasUncommittedChanges(projectId: string): Promise<boolean> {
    try {
      const status = await this.getStatus(projectId);
      return status.staged.length > 0 || status.unstaged.length > 0 || status.untracked.length > 0;
    } catch (error) {
      return false;
    }
  }
}

export const realGitService = new RealGitService();
