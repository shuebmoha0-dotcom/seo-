import { Octokit } from 'octokit';
import { PlatformConnector, GenericAction } from '../agent/types';

export class GitHubConnector implements PlatformConnector {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private defaultBranch: string;

  constructor(accessToken: string, owner: string, repo: string, defaultBranch: string = 'main') {
    this.octokit = new Octokit({ auth: accessToken });
    this.owner = owner;
    this.repo = repo;
    this.defaultBranch = defaultBranch;
  }

  async identify_framework(files: string[]): Promise<string | null> {
    if (files.includes('next.config.js') || files.includes('next.config.ts')) return 'nextjs';
    if (files.includes('astro.config.mjs')) return 'astro';
    if (files.includes('nuxt.config.ts')) return 'nuxt';
    if (files.includes('gatsby-config.js')) return 'gatsby';
    if (files.includes('package.json')) {
      const packageJsonStr = await this.getFileContent('package.json');
      if (packageJsonStr) {
        try {
          const pkg = JSON.parse(packageJsonStr);
          if (pkg.dependencies?.react) return 'react-spa';
        } catch (e) {
          // parse error
        }
      }
    }
    return 'html'; // fallback
  }

  async get_page_source(url_path: string): Promise<string | null> {
    // In a real implementation, this would use the identified framework to map
    // the URL path (e.g. /about) to the correct file path (e.g. src/app/about/page.tsx or pages/about.js).
    // For Phase 1 abstraction, we'll return a mock path or do a basic search.
    // Example: mapping /about to app/about/page.tsx (Next.js app router)
    const normalizedPath = url_path === '/' ? '' : url_path;
    const potentialPaths = [
      `src/app${normalizedPath}/page.tsx`,
      `app${normalizedPath}/page.tsx`,
      `pages${normalizedPath}.tsx`,
      `src/pages${normalizedPath}.tsx`,
      `src/pages${normalizedPath}/index.tsx`,
      `public${url_path === '/' ? '/index' : normalizedPath}.html`
    ];

    for (const p of potentialPaths) {
      const content = await this.getFileContent(p);
      if (content) return content;
    }
    return null;
  }

  async translate_action_to_diff(action: GenericAction): Promise<{ file_path: string; diff_before: string; diff_after: string; }[]> {
    // LLM should Ideally be invoked here or this function orchestrates calling the LLM
    // with the file content to perform the precise search-and-replace.
    // For this abstraction layer, we return the structure.
    throw new Error('Not implemented: translate_action_to_diff requires LLM integration to safely mutate file contents based on AST or smart replace.');
  }

  async execute_changes(
    branch_name: string,
    changes: { file_path: string; new_content: string }[],
    pr_title: string,
    pr_body: string
  ): Promise<{ pr_url: string; pr_number: number }> {
    
    // 1. Get reference to default branch
    const { data: refData } = await this.octokit.rest.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${this.defaultBranch}`,
    });
    const latestCommitSha = refData.object.sha;

    // 2. Create new branch
    await this.octokit.rest.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${branch_name}`,
      sha: latestCommitSha,
    });

    // 3. For each change, we could do a create or update file
    // For simplicity, using the commits API
    
    // 3a. Get current tree
    const { data: latestCommitData } = await this.octokit.rest.git.getCommit({
      owner: this.owner,
      repo: this.repo,
      commit_sha: latestCommitSha,
    });
    const baseTreeSha = latestCommitData.tree.sha;

    // 3b. Create tree with new changes
    const tree = changes.map(change => ({
      path: change.file_path,
      mode: '100644' as const,
      type: 'blob' as const,
      content: change.new_content,
    }));

    const { data: newTreeData } = await this.octokit.rest.git.createTree({
      owner: this.owner,
      repo: this.repo,
      base_tree: baseTreeSha,
      tree,
    });

    // 3c. Create commit
    const { data: newCommitData } = await this.octokit.rest.git.createCommit({
      owner: this.owner,
      repo: this.repo,
      message: pr_title,
      tree: newTreeData.sha,
      parents: [latestCommitSha],
    });

    // 3d. Update branch ref to point to new commit
    await this.octokit.rest.git.updateRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${branch_name}`,
      sha: newCommitData.sha,
    });

    // 4. Create Pull Request
    const { data: prData } = await this.octokit.rest.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title: pr_title,
      body: pr_body,
      head: branch_name,
      base: this.defaultBranch,
    });

    return {
      pr_url: prData.html_url,
      pr_number: prData.number,
    };
  }

  private async getFileContent(path: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.defaultBranch,
      });

      if (!Array.isArray(data) && data.type === 'file' && data.content) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return null;
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  }
}
