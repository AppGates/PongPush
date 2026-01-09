/**
 * Git utilities for workflow automation
 * Wraps common git operations with error handling and logging
 */

import type { Logger } from './logger';
import { spawnGitCommand } from './process';

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
      const result = await spawnGitCommand(['log', '-1', '--pretty=%s'], this.logger);
      if (!result.success) {
        throw new Error(`git log failed with exit code ${result.exitCode}`);
      }
      this.logger.debug(`Latest commit message: ${result.stdout}`);
      return result.stdout;
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
      const result = await spawnGitCommand(['rev-parse', 'HEAD'], this.logger);
      if (!result.success) {
        throw new Error(`git rev-parse failed with exit code ${result.exitCode}`);
      }
      this.logger.debug(`Latest commit SHA: ${result.stdout}`);
      return result.stdout;
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
      const result = await spawnGitCommand(['log', `${from}..${to}`, formatFlag], this.logger);
      if (!result.success) {
        this.logger.error(`git log failed with exit code ${result.exitCode}: ${result.stderr}`);
        return [];
      }
      return result.stdout ? result.stdout.split('\n') : [];
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
      const result = await spawnGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], this.logger);
      if (!result.success) {
        throw new Error(`git rev-parse failed with exit code ${result.exitCode}`);
      }
      this.logger.debug(`Current branch: ${result.stdout}`);
      return result.stdout;
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
      const nameResult = await spawnGitCommand(['config', 'user.name', name], this.logger);
      if (!nameResult.success) {
        throw new Error(`git config user.name failed with exit code ${nameResult.exitCode}`);
      }

      const emailResult = await spawnGitCommand(['config', 'user.email', email], this.logger);
      if (!emailResult.success) {
        throw new Error(`git config user.email failed with exit code ${emailResult.exitCode}`);
      }

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
        const result = await spawnGitCommand(['add', '-f', path], this.logger);
        if (!result.success) {
          throw new Error(`git add failed for ${path} with exit code ${result.exitCode}`);
        }
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
      const result = await spawnGitCommand(['commit', '-m', message], this.logger);
      if (!result.success) {
        // git commit returns non-zero if nothing to commit
        if (result.stdout.includes('nothing to commit') || result.stderr.includes('nothing to commit')) {
          this.logger.info('No changes to commit');
          return false;
        }
        throw new Error(`git commit failed with exit code ${result.exitCode}: ${result.stderr}`);
      }
      this.logger.success(`Committed: ${message}`);
      return true;
    } catch (error) {
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
        const result = await spawnGitCommand(['push', '-u', remote, ref], this.logger);

        if (!result.success) {
          const errorStr = result.stderr;

          // Check for 403 error (wrong branch name)
          if (errorStr.includes('403')) {
            this.logger.error('Push failed with 403 - branch name must start with "claude/" and match session ID');
            throw new Error('Push failed with 403');
          }

          // Check if this is a network error that we should retry
          const isNetworkError = errorStr.includes('Connection') ||
                                 errorStr.includes('timeout') ||
                                 errorStr.includes('reset');

          if (isNetworkError && attempt < maxRetries) {
            const delay = delays[attempt];
            this.logger.warn(`Push failed, retrying in ${delay}ms...`);
            await Bun.sleep(delay);
            continue;
          } else {
            this.logger.error(`Failed to push: ${errorStr}`);
            if (attempt === maxRetries) {
              this.logger.error(`All ${maxRetries + 1} push attempts failed`);
            }
            throw new Error(`Push failed: ${errorStr}`);
          }
        }

        this.logger.success(`Successfully pushed to ${remote} ${ref}`);
        return true;
      } catch (error) {
        if (attempt === maxRetries) {
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
    const args = branch ? ['fetch', remote, branch] : ['fetch', remote];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.logger.info(`Fetching from ${remote} ${branch || ''} (attempt ${attempt + 1}/${maxRetries + 1})`);

        const result = await spawnGitCommand(args, this.logger);

        if (!result.success) {
          const errorStr = result.stderr;
          const isNetworkError = errorStr.includes('Connection') ||
                                 errorStr.includes('timeout') ||
                                 errorStr.includes('reset');

          if (isNetworkError && attempt < maxRetries) {
            const delay = delays[attempt];
            this.logger.warn(`Fetch failed, retrying in ${delay}ms...`);
            await Bun.sleep(delay);
            continue;
          } else {
            this.logger.error(`Failed to fetch: ${errorStr}`);
            if (attempt === maxRetries) {
              this.logger.error(`All ${maxRetries + 1} fetch attempts failed`);
            }
            throw new Error(`Fetch failed: ${errorStr}`);
          }
        }

        this.logger.success(`Successfully fetched from ${remote}`);
        return true;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }

    return false;
  }
}
