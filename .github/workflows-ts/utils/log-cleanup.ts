/**
 * Log Cleanup Utility
 * Manages CI log directories organized by commit SHA
 */

import { Logger } from './logger';
import { spawnProcess } from './process';
import * as fs from 'fs';
import * as path from 'path';

export interface LogCleanupOptions {
  logDir: string;          // Base log directory (e.g., 'ci-logs')
  currentCommit: string;   // Current commit SHA to preserve
  dryRun?: boolean;        // If true, only log what would be deleted
}

/**
 * Clean up old log directories, keeping only the current commit's logs
 */
export async function cleanupOldLogs(options: LogCleanupOptions, logger: Logger): Promise<void> {
  const { logDir, currentCommit, dryRun = false } = options;
  const shortCommit = currentCommit.substring(0, 7);

  logger.subsection('Cleaning Up Old Logs');
  logger.info(`Log directory: ${logDir}`);
  logger.info(`Current commit: ${shortCommit}`);
  logger.info(`Dry run: ${dryRun ? 'yes' : 'no'}`);

  // Check if log directory exists
  if (!fs.existsSync(logDir)) {
    logger.info('Log directory does not exist yet, nothing to clean');
    return;
  }

  // Get all subdirectories in the log directory
  const entries = fs.readdirSync(logDir, { withFileTypes: true });
  const directories = entries.filter(e => e.isDirectory()).map(e => e.name);

  if (directories.length === 0) {
    logger.info('No log subdirectories found');
    return;
  }

  logger.info(`Found ${directories.length} log directory(ies)`);

  let deletedCount = 0;
  let preservedCount = 0;

  for (const dir of directories) {
    const fullPath = path.join(logDir, dir);

    // Preserve the current commit's directory
    if (dir === shortCommit || dir === currentCommit) {
      logger.debug(`Preserving: ${dir} (current commit)`);
      preservedCount++;
      continue;
    }

    // Delete old commit directories
    if (dryRun) {
      logger.info(`Would delete: ${dir}`);
      deletedCount++;
    } else {
      try {
        logger.debug(`Deleting: ${dir}`);
        fs.rmSync(fullPath, { recursive: true, force: true });
        deletedCount++;
      } catch (error) {
        logger.warn(`Failed to delete ${dir}: ${error}`);
      }
    }
  }

  logger.info(`Cleanup complete: ${deletedCount} deleted, ${preservedCount} preserved`);
}

/**
 * Get the log directory path for a specific commit
 */
export function getCommitLogDir(baseDir: string, commitSha: string): string {
  const shortSha = commitSha.substring(0, 7);
  return path.join(baseDir, shortSha);
}

/**
 * Ensure the log directory for the current commit exists
 */
export function ensureCommitLogDir(baseDir: string, commitSha: string, logger: Logger): string {
  const logDir = getCommitLogDir(baseDir, commitSha);

  if (!fs.existsSync(logDir)) {
    logger.debug(`Creating log directory: ${logDir}`);
    fs.mkdirSync(logDir, { recursive: true });
  }

  return logDir;
}
