/**
 * GitHub Client
 * 
 * GitHub REST API client for code execution, branch management,
 * commit creation, and automated Pull Requests with human approval workflows.
 * Isolates tokens from agents.
 */

import { Octokit } from 'octokit';

export interface GitHubRepoSummary {
  full_name: string;
  name: string;
  owner: string;
  default_branch: string;
  private: boolean;
}

export class GitHubClient {
  private octokit: Octokit;

  constructor(accessToken: string) {
    this.octokit = new Octokit({ auth: accessToken });
  }

  /**
   * 1. Get authenticated GitHub user
   */
  async getAuthenticatedUser(): Promise<{ login: string; id: number; name?: string; email?: string }> {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      return {
        login: data.login,
        id: data.id,
        name: data.name || undefined,
        email: data.email || undefined,
      };
    } catch (err: any) {
      if (err.status === 401) {
        throw new Error('REAUTH_REQUIRED: GitHub token has expired or was revoked.');
      }
      throw err;
    }
  }

  /**
   * 2. List accessible repositories
   */
  async getRepositories(perPage = 100): Promise<GitHubRepoSummary[]> {
    try {
      const { data } = await this.octokit.rest.repos.listForAuthenticatedUser({
        per_page: perPage,
        sort: 'updated',
        affiliation: 'owner,collaborator,organization_member',
      });

      return data.map(repo => ({
        full_name: repo.full_name,
        name: repo.name,
        owner: repo.owner.login,
        default_branch: repo.default_branch || 'main',
        private: repo.private,
      }));
    } catch (err: any) {
      if (err.status === 401) {
        throw new Error('REAUTH_REQUIRED: GitHub token has expired or was revoked.');
      }
      throw err;
    }
  }

  /**
   * 3. List branches for a repository
   */
  async getBranches(owner: string, repo: string): Promise<string[]> {
    try {
      const { data } = await this.octokit.rest.repos.listBranches({
        owner,
        repo,
        per_page: 100,
      });
      return data.map(b => b.name);
    } catch (err: any) {
      if (err.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found or access denied.`);
      }
      throw err;
    }
  }

  /**
   * 4. Read file content from repository
   */
  async getFileContent(owner: string, repo: string, path: string, branch = 'main'): Promise<string | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      if (!Array.isArray(data) && data.type === 'file' && data.content) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return null;
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  /**
   * 5. Create a dedicated agent SEO branch from base branch
   */
  async createBranch(owner: string, repo: string, branchName: string, baseBranch = 'main'): Promise<{ branch: string; sha: string }> {
    try {
      // Get reference commit sha of base branch
      const { data: refData } = await this.octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`,
      });
      const baseSha = refData.object.sha;

      // Create new branch
      const formattedBranch = branchName.startsWith('agent/seo/') ? branchName : `agent/seo/${branchName.replace(/^agent\/seo\//, '')}`;
      await this.octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${formattedBranch}`,
        sha: baseSha,
      });

      return { branch: formattedBranch, sha: baseSha };
    } catch (err: any) {
      if (err.status === 422 && err.message?.includes('Reference already exists')) {
        // Branch already exists, retrieve it
        const { data: existingRef } = await this.octokit.rest.git.getRef({
          owner,
          repo,
          ref: `heads/${branchName}`,
        });
        return { branch: branchName, sha: existingRef.object.sha };
      }
      throw err;
    }
  }

  /**
   * 6. Commit multiple files into a branch
   */
  async commitChanges(
    owner: string,
    repo: string,
    branch: string,
    changes: Array<{ file_path: string; new_content: string }>,
    commitMessage: string
  ): Promise<{ commit_sha: string }> {
    // 1. Get latest commit on target branch
    const { data: refData } = await this.octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const latestCommitSha = refData.object.sha;

    // 2. Get tree of latest commit
    const { data: latestCommit } = await this.octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: latestCommitSha,
    });

    // 3. Create tree with file changes
    const tree = changes.map(c => ({
      path: c.file_path,
      mode: '100644' as const,
      type: 'blob' as const,
      content: c.new_content,
    }));

    const { data: newTree } = await this.octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: latestCommit.tree.sha,
      tree,
    });

    // 4. Create new commit
    const { data: newCommit } = await this.octokit.rest.git.createCommit({
      owner,
      repo,
      message: commitMessage,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    // 5. Update branch pointer
    await this.octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return { commit_sha: newCommit.sha };
  }

  /**
   * 7. Open Pull Request with human approval details
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    headBranch: string,
    baseBranch = 'main'
  ): Promise<{ pr_url: string; pr_number: number; pr_title: string }> {
    try {
      const { data: pr } = await this.octokit.rest.pulls.create({
        owner,
        repo,
        title,
        body,
        head: headBranch,
        base: baseBranch,
      });

      return {
        pr_url: pr.html_url,
        pr_number: pr.number,
        pr_title: pr.title,
      };
    } catch (err: any) {
      if (err.status === 422 && err.message?.includes('A pull request already exists')) {
        // Return existing open PR
        const { data: existingPrs } = await this.octokit.rest.pulls.list({
          owner,
          repo,
          head: `${owner}:${headBranch}`,
          state: 'open',
        });
        if (existingPrs.length > 0) {
          return {
            pr_url: existingPrs[0].html_url,
            pr_number: existingPrs[0].number,
            pr_title: existingPrs[0].title,
          };
        }
      }
      throw err;
    }
  }

  /**
   * 8. Test connection to a repository
   */
  async testConnection(owner?: string, repo?: string): Promise<{ ok: boolean; message: string; user?: string }> {
    try {
      const user = await this.getAuthenticatedUser();

      if (owner && repo) {
        const { data } = await this.octokit.rest.repos.get({ owner, repo });
        return {
          ok: true,
          message: `Connected to repository ${data.full_name} (${data.default_branch}) as @${user.login}`,
          user: user.login,
        };
      }

      return {
        ok: true,
        message: `Connected to GitHub as @${user.login}`,
        user: user.login,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err.message || 'GitHub connection test failed.',
      };
    }
  }
}
