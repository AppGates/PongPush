/**
 * GitHub API utilities for workflow automation
 * Wraps common GitHub operations with error handling and logging
 */

import type { Logger } from './logger';

export interface PullRequest {
  number: number;
  title: string;
  state: string;
  mergeable?: boolean;
  mergeStateStatus?: string;
  autoMergeRequest?: any;
  statusCheckRollup?: any[];
}

export interface RepositorySettings {
  allow_auto_merge: boolean;
  allow_merge_commit: boolean;
  allow_squash_merge: boolean;
  allow_rebase_merge: boolean;
}

export class GitHubClient {
  private token: string;
  private repository: string;
  private logger: Logger;

  constructor(token: string, repository: string, logger: Logger) {
    this.token = token;
    this.repository = repository;
    this.logger = logger.child('GitHub');
  }

  /**
   * Get repository settings
   */
  async getRepositorySettings(): Promise<RepositorySettings | null> {
    try {
      const proc = Bun.spawn(['gh', 'api', `repos/${this.repository}`, '--jq', '{allow_auto_merge, allow_merge_commit, allow_squash_merge, allow_rebase_merge}'], {
        env: { ...process.env, GH_TOKEN: this.token, GITHUB_TOKEN: this.token },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        this.logger.error(`gh api failed with exit code ${exitCode}`);
        if (stderr) this.logger.error(`stderr: ${stderr}`);
        return null;
      }

      const settings = JSON.parse(stdout);
      this.logger.debug(`Repository settings: ${JSON.stringify(settings, null, 2)}`);
      return settings;
    } catch (error) {
      this.logger.error(`Failed to get repository settings: ${error}`);
      return null;
    }
  }

  /**
   * Check if a PR exists for the given branch
   */
  async findPullRequest(branch: string): Promise<number | null> {
    try {
      const proc = Bun.spawn(['gh', 'pr', 'list', '--head', branch, '--json', 'number', '--jq', '.[0].number'], {
        env: { ...process.env, GH_TOKEN: this.token, GITHUB_TOKEN: this.token },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        this.logger.error(`gh pr list failed with exit code ${exitCode}`);
        if (stderr) this.logger.error(`stderr: ${stderr.trim()}`);
        return null;
      }

      const output = stdout.trim();
      if (output && output !== 'null') {
        const prNumber = parseInt(output, 10);
        this.logger.info(`Found existing PR #${prNumber} for branch ${branch}`);
        return prNumber;
      }

      this.logger.info(`No existing PR found for branch ${branch}`);
      return null;
    } catch (error) {
      this.logger.error(`Failed to check for existing PR: ${error}`);
      return null;
    }
  }

  /**
   * Get PR details
   */
  async getPullRequestDetails(prNumber: number): Promise<PullRequest | null> {
    try {
      const proc = Bun.spawn(['gh', 'pr', 'view', String(prNumber), '--json', 'number,title,state,mergeable,mergeStateStatus,autoMergeRequest,statusCheckRollup'], {
        env: { ...process.env, GH_TOKEN: this.token, GITHUB_TOKEN: this.token },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        this.logger.error(`gh pr view failed with exit code ${exitCode}`);
        if (stderr) this.logger.error(`stderr: ${stderr.trim()}`);
        return null;
      }

      const pr = JSON.parse(stdout);
      this.logger.debug(`PR #${prNumber} details: ${JSON.stringify(pr, null, 2)}`);
      return pr;
    } catch (error) {
      this.logger.error(`Failed to get PR details: ${error}`);
      return null;
    }
  }

  /**
   * Create a new pull request
   */
  async createPullRequest(
    title: string,
    body: string,
    base: string,
    head: string
  ): Promise<{ number: number; url: string } | null> {
    try {
      this.logger.info(`Creating PR: "${title}"`);
      this.logger.debug(`Base: ${base}, Head: ${head}`);

      const proc = Bun.spawn(['gh', 'pr', 'create', '--title', title, '--body', body, '--base', base, '--head', head], {
        env: { ...process.env, GH_TOKEN: this.token, GITHUB_TOKEN: this.token },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        this.logger.error(`gh pr create failed with exit code ${exitCode}`);
        if (stderr) this.logger.error(`stderr: ${stderr.trim()}`);
        return null;
      }

      const url = stdout.trim();
      this.logger.success(`PR created: ${url}`);

      // Extract PR number from URL
      const match = url.match(/\/pull\/(\d+)$/);
      if (match) {
        const number = parseInt(match[1], 10);
        return { number, url };
      }

      // Fallback: try to find the PR
      const number = await this.findPullRequest(head);
      if (number) {
        return { number, url };
      }

      this.logger.warn('Could not extract PR number from response');
      return null;
    } catch (error) {
      this.logger.error(`Failed to create PR: ${error}`);
      return null;
    }
  }

  /**
   * Enable auto-merge for a PR
   */
  async enableAutoMerge(prNumber: number, mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge'): Promise<boolean> {
    try {
      this.logger.info(`Enabling auto-merge for PR #${prNumber} with method: ${mergeMethod}`);

      const flag = mergeMethod === 'squash' ? '--squash' : mergeMethod === 'rebase' ? '--rebase' : '--merge';
      const proc = Bun.spawn(['gh', 'pr', 'merge', String(prNumber), '--auto', flag], {
        env: { ...process.env, GH_TOKEN: this.token, GITHUB_TOKEN: this.token },
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        this.logger.warn(`gh pr merge --auto failed with exit code ${exitCode}`);
        if (stderr) this.logger.warn(`stderr: ${stderr.trim()}`);
        return false;
      }

      this.logger.success(`Auto-merge enabled successfully for PR #${prNumber}`);
      return true;
    } catch (error) {
      this.logger.warn(`Auto-merge command failed: ${error}`);
      return false;
    }
  }

  /**
   * Check if auto-merge is enabled for a PR
   */
  async isAutoMergeEnabled(prNumber: number): Promise<boolean> {
    const pr = await this.getPullRequestDetails(prNumber);
    return pr?.autoMergeRequest != null;
  }
}
