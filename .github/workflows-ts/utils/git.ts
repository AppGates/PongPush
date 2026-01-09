/**
 * Git utilities for workflow automation
 * Wraps common git operations with error handling and logging
 */

import { $ } from 'bun';
import type { Logger } from './logger';

export class GitClient {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child('Git');
  }

  /**
   * Get the latest commit message
   */
  async getLatestCommitMessage(): Promise<string> {
    try {
      const result = await $`git log -1 --pretty=%s`.quiet();
      const message = result.stdout.toString().trim();
      this.logger.debug(`Latest commit message: ${message}`);
      return message;
    } catch (error) {
      this.logger.error(`Failed to get commit message: ${error}`);
      throw error;
    }
  }

  /**
   * Get the latest commit SHA
   */
  async getLatestCommitSha(): Promise<string> {
    try {
      const result = await $`git rev-parse HEAD`.quiet();
      const sha = result.stdout.toString().trim();
      this.logger.debug(`Latest commit SHA: ${sha}`);
      return sha;
    } catch (error) {
      this.logger.error(`Failed to get commit SHA: ${error}`);
      throw error;
    }
  }

  /**
   * Get commit log between two refs
   */
  async getCommitLog(from: string, to: string, format: 'oneline' | 'short' | 'full' = 'oneline'): Promise<string[]> {
    try {
      const formatFlag = `--${format}`;
      const result = await $`git log ${from}..${to} ${formatFlag}`.quiet();
      const log = result.stdout.toString().trim();
      return log ? log.split('\n') : [];
    } catch (error) {
      this.logger.error(`Failed to get commit log: ${error}`);
      return [];
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const result = await $`git rev-parse --abbrev-ref HEAD`.quiet();
      const branch = result.stdout.toString().trim();
      this.logger.debug(`Current branch: ${branch}`);
      return branch;
    } catch (error) {
      this.logger.error(`Failed to get current branch: ${error}`);
      throw error;
    }
  }

  /**
   * Configure git user
   */
  async configureUser(name: string, email: string): Promise<void> {
    try {
      await $`git config user.name ${name}`.quiet();
      await $`git config user.email ${email}`.quiet();
      this.logger.debug(`Git user configured: ${name} <${email}>`);
    } catch (error) {
      this.logger.error(`Failed to configure git user: ${error}`);
      throw error;
    }
  }

  /**
   * Add files to staging area
   */
  async add(paths: string[]): Promise<void> {
    try {
      for (const path of paths) {
        await $`git add -f ${path}`.quiet();
      }
      this.logger.debug(`Added ${paths.length} file(s) to staging area`);
    } catch (error) {
      this.logger.error(`Failed to add files: ${error}`);
      throw error;
    }
  }

  /**
   * Commit changes
   */
  async commit(message: string): Promise<boolean> {
    try {
      await $`git commit -m ${message}`.quiet();
      this.logger.success(`Committed: ${message}`);
      return true;
    } catch (error) {
      // git commit returns non-zero if nothing to commit
      const errorStr = String(error);
      if (errorStr.includes('nothing to commit')) {
        this.logger.info('No changes to commit');
        return false;
      }
      this.logger.error(`Failed to commit: ${error}`);
      throw error;
    }
  }

  /**
   * Push to remote with retry logic
   */
  async push(remote: string, ref: string, maxRetries: number = 4): Promise<boolean> {
    const delays = [2000, 4000, 8000, 16000]; // Exponential backoff

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`Pushing to ${remote} ${ref} (attempt ${attempt + 1}/${maxRetries + 1})`);
        await $`git push -u ${remote} ${ref}`.quiet();
        this.logger.success(`Successfully pushed to ${remote} ${ref}`);
        return true;
      } catch (error) {
        const errorStr = String(error);

        // Check for 403 error (wrong branch name)
        if (errorStr.includes('403')) {
          this.logger.error('Push failed with 403 - branch name must start with "claude/" and match session ID');
          throw error;
        }

        // Check if this is a network error that we should retry
        const isNetworkError = errorStr.includes('Connection') ||
                               errorStr.includes('timeout') ||
                               errorStr.includes('reset');

        if (isNetworkError && attempt < maxRetries) {
          const delay = delays[attempt];
          this.logger.warn(`Push failed, retrying in ${delay}ms...`);
          await Bun.sleep(delay);
        } else {
          this.logger.error(`Failed to push: ${error}`);
          if (attempt === maxRetries) {
            this.logger.error(`All ${maxRetries + 1} push attempts failed`);
          }
          throw error;
        }
      }
    }

    return false;
  }

  /**
   * Fetch from remote with retry logic
   */
  async fetch(remote: string, branch?: string, maxRetries: number = 4): Promise<boolean> {
    const delays = [2000, 4000, 8000, 16000]; // Exponential backoff
    const refspec = branch ? branch : '';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`Fetching from ${remote} ${refspec} (attempt ${attempt + 1}/${maxRetries + 1})`);

        if (refspec) {
          await $`git fetch ${remote} ${refspec}`.quiet();
        } else {
          await $`git fetch ${remote}`.quiet();
        }

        this.logger.success(`Successfully fetched from ${remote}`);
        return true;
      } catch (error) {
        const errorStr = String(error);
        const isNetworkError = errorStr.includes('Connection') ||
                               errorStr.includes('timeout') ||
                               errorStr.includes('reset');

        if (isNetworkError && attempt < maxRetries) {
          const delay = delays[attempt];
          this.logger.warn(`Fetch failed, retrying in ${delay}ms...`);
          await Bun.sleep(delay);
        } else {
          this.logger.error(`Failed to fetch: ${error}`);
          if (attempt === maxRetries) {
            this.logger.error(`All ${maxRetries + 1} fetch attempts failed`);
          }
          throw error;
        }
      }
    }

    return false;
  }
}
