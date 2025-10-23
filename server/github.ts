import type { GitHubRepo, GitHubFile } from "@shared/schema";

const GITHUB_API_BASE = "https://api.github.com";

export class GitHubService {
  constructor(private accessToken: string) {}

  async fetch(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${this.accessToken}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Android-Studio-Web",
      ...(options.headers as Record<string, string>),
    };

    if (options.method === 'POST' || options.method === 'PATCH' || options.method === 'PUT') {
      headers["Content-Type"] = "application/json; charset=utf-8";
    }

    const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    return response.json();
  }

  async getUserInfo() {
    return this.fetch("/user");
  }

  async listRepos(): Promise<GitHubRepo[]> {
    const repos = await this.fetch("/user/repos?sort=updated&per_page=100");
    return repos;
  }

  async getRepoContents(owner: string, repo: string, path: string = ""): Promise<any[]> {
    return this.fetch(`/repos/${owner}/${repo}/contents/${path}`);
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    const file = await this.fetch(`/repos/${owner}/${repo}/contents/${path}`);
    if (file.content) {
      return Buffer.from(file.content, "base64").toString("utf-8");
    }
    throw new Error("File content not found");
  }

  async getRepoTree(owner: string, repo: string, branch: string = "main"): Promise<GitHubFile[]> {
    const tree = await this.fetch(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
    
    const files: GitHubFile[] = [];
    for (const item of tree.tree) {
      if (item.type === "blob") {
        try {
          const content = await this.getFileContent(owner, repo, item.path);
          files.push({
            path: item.path,
            content,
            type: "file",
          });
        } catch (error) {
          console.error(`Failed to fetch ${item.path}:`, error);
        }
      }
    }
    
    return files;
  }

  async listBranches(owner: string, repo: string) {
    return this.fetch(`/repos/${owner}/${repo}/branches`);
  }

  async listCommits(owner: string, repo: string, branch: string = "main", perPage: number = 30) {
    return this.fetch(`/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${perPage}`);
  }

  async createCommit(owner: string, repo: string, branch: string, message: string, files: GitHubFile[]) {
    const branchData = await this.fetch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`);
    const baseCommitSha = branchData.object.sha;

    const baseTreeSha = await this.fetch(`/repos/${owner}/${repo}/git/commits/${baseCommitSha}`)
      .then(commit => commit.tree.sha);

    const treeData = await this.fetch(`/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: files.map(file => ({
          path: file.path,
          mode: "100644",
          type: "blob",
          content: file.content,
        })),
      }),
    });

    const commitData = await this.fetch(`/repos/${owner}/${repo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message,
        tree: treeData.sha,
        parents: [baseCommitSha],
      }),
    });

    await this.fetch(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: "PATCH",
      body: JSON.stringify({
        sha: commitData.sha,
      }),
    });

    return commitData;
  }
}
