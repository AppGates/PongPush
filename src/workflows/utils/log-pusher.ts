/**
 * Log pusher utility
 * Handles pushing workflow logs to the branch for later review
 */

import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'fs';
import { GitClient } from './git';
import type { Logger } from './logger';

export interface LogPusherOptions {
  logFile?: string;
  jobName: string;
  outputLogName?: string;
  additionalFiles?: { source: string; dest: string }[];
}

export class LogPusher {
  private logger: Logger;
  private git: GitClient;
  private logDir = 'ci-logs';

  constructor(logger: Logger) {
    this.logger = logger.child('LogPusher');
    this.git = new GitClient(logger);
  }

  /**
   * Push logs to the current branch
   */
  async pushLogs(options: LogPusherOptions): Promise<boolean> {
    try {
      const { logFile, jobName, outputLogName, additionalFiles = [] } = options;

      this.logger.info('Preparing to push logs to branch...');

      // Create logs directory
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
      }

      // Copy main job log
      if (logFile && existsSync(logFile)) {
        const destLog = `${this.logDir}/${outputLogName || jobName + '-output.log'}`;
        copyFileSync(logFile, destLog);
        this.logger.debug(`Copied log file: ${logFile} -> ${destLog}`);
      }

      // Copy additional files
      for (const { source, dest } of additionalFiles) {
        if (existsSync(source)) {
          const destPath = `${this.logDir}/${dest}`;
          copyFileSync(source, destPath);
          this.logger.debug(`Copied additional file: ${source} -> ${destPath}`);
        }
      }

      // Create summary
      const sha = process.env.GITHUB_SHA || 'unknown';
      const ref = process.env.GITHUB_REF || 'unknown';
      const timestamp = new Date().toISOString();

      const summary = [
        `=== ${jobName} Workflow Log ===`,
        `Date: ${timestamp}`,
        `Commit: ${sha}`,
        `Ref: ${ref}`,
        `Job: ${jobName}`,
        '',
        '=== Files ===',
        `Log file: ${this.logDir}/${outputLogName || jobName + '-output.log'}`,
      ].join('\n');

      writeFileSync(`${this.logDir}/${jobName}-summary.txt`, summary);

      // Configure git
      await this.git.configureUser('github-actions[bot]', 'github-actions[bot]@users.noreply.github.com');

      // Add and commit logs
      await this.git.add([`${this.logDir}/`]);
      const committed = await this.git.commit(`CI: Add ${jobName} logs for ${sha}`);

      if (!committed) {
        this.logger.info('No new logs to push');
        return false;
      }

      // Push to the current branch
      const refName = ref.replace('refs/heads/', '');
      await this.git.push('origin', `HEAD:${ref}`);

      this.logger.success('Logs pushed successfully');
      return true;

    } catch (error) {
      this.logger.error(`Failed to push logs: ${error}`);
      return false;
    }
  }
}
