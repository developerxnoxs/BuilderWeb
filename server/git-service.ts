import crypto from 'crypto';
import type { GitCommit, InsertGitCommit } from '@shared/schema';

export interface GitStatusResponse {
  initialized: boolean;
  currentBranch: string;
  uncommittedChanges: number;
  totalCommits: number;
}

export interface GitHistoryItem {
  id: string;
  commitHash: string;
  message: string;
  author: string;
  email?: string;
  branch: string;
  filesChanged?: any;
  createdAt: Date;
}

export class GitService {
  generateCommitHash(): string {
    return crypto.randomBytes(20).toString('hex');
  }

  createCommit(params: {
    projectId: string;
    message: string;
    author: string;
    email?: string;
    branch?: string;
    filesChanged?: any[];
  }): InsertGitCommit {
    return {
      projectId: params.projectId,
      commitHash: this.generateCommitHash(),
      message: params.message,
      author: params.author,
      email: params.email,
      branch: params.branch || 'main',
      filesChanged: params.filesChanged as any,
    };
  }

  validateCommitMessage(message: string): { valid: boolean; error?: string } {
    if (!message || message.trim().length === 0) {
      return { valid: false, error: 'Commit message cannot be empty' };
    }
    
    if (message.length > 500) {
      return { valid: false, error: 'Commit message too long (max 500 characters)' };
    }
    
    return { valid: true };
  }

  validateBranchName(branchName: string): { valid: boolean; error?: string } {
    if (!branchName || branchName.trim().length === 0) {
      return { valid: false, error: 'Branch name cannot be empty' };
    }
    
    const validBranchNameRegex = /^[a-zA-Z0-9_\-\/\.]+$/;
    if (!validBranchNameRegex.test(branchName)) {
      return { valid: false, error: 'Invalid branch name format' };
    }
    
    if (branchName.length > 100) {
      return { valid: false, error: 'Branch name too long (max 100 characters)' };
    }
    
    return { valid: true };
  }

  generateGitStatus(commits: GitCommit[], uncommittedChanges: number): GitStatusResponse {
    const currentBranch = commits.length > 0 ? commits[0].branch : 'main';
    
    return {
      initialized: commits.length > 0,
      currentBranch,
      uncommittedChanges,
      totalCommits: commits.length,
    };
  }
}

export const gitService = new GitService();
