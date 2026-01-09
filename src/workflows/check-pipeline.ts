#!/usr/bin/env bun

/**
 * Pipeline Status Checker
 * Waits for CI logs to be pushed and analyzes them for errors
 * Works by polling the branch and checking for ci-logs/<commit-sha>/
 */

import { spawnGitCommand } from './utils/process';
import { Logger } from './utils/logger';
import { readFileSync, existsSync, readdirSync } from 'fs';

interface CheckResult {
  success: boolean;
  duration: number;
  conclusion: string;
  logFiles: string[];
  errors: string[];
}

const logger = new Logger({ prefix: 'PipelineCheck' });

async function getCurrentBranch(): Promise<string> {
  const result = await spawnGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], logger);
  if (!result.success) {
    throw new Error('Failed to get current branch');
  }
  return result.stdout;
}

async function getLatestCommitSha(): Promise<string> {
  const result = await spawnGitCommand(['rev-parse', 'HEAD'], logger);
  if (!result.success) {
    throw new Error('Failed to get commit SHA');
  }
  return result.stdout;
}

async function pullBranch(branch: string): Promise<boolean> {
  try {
    const result = await spawnGitCommand(['pull', 'origin', branch, '--rebase'], logger);
    return result.success;
  } catch (error) {
    return false;
  }
}

async function waitForLogs(branch: string, sha: string, timeoutSeconds = 60, skipWait = false): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 10000; // 10 seconds
  const shortSha = sha.substring(0, 7);
  const logDir = `ci-logs/${shortSha}`;

  logger.section('Waiting for CI Logs');
  logger.info(`Branch: ${branch}`);
  logger.info(`Commit: ${shortSha}`);
  logger.info(`Looking for: ${logDir}/`);

  if (skipWait) {
    logger.info('Checking current status only (no waiting)');
  } else {
    logger.info(`Timeout: ${timeoutSeconds}s`);
    logger.info(`Poll interval: ${pollInterval / 1000}s`);
  }
  logger.info('');

  while (true) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    // Check if logs directory exists
    if (existsSync(logDir)) {
      logger.success(`Found logs at ${logDir}/`);
      return true;
    }

    if (skipWait) {
      logger.warn(`Logs not found at ${logDir}/ (workflow may still be running)`);
      return false;
    }

    if (elapsed >= timeoutSeconds) {
      logger.warn(`Timeout after ${timeoutSeconds}s - logs not found yet`);
      logger.info('Workflow may still be running or failed to start');
      return false;
    }

    logger.info(`[${elapsed}s] Logs not found yet, pulling branch...`);

    // Pull the branch to get latest commits with logs
    await pullBranch(branch);

    // Wait before next check
    await Bun.sleep(pollInterval);
  }
}

function findLogFiles(sha?: string): string[] {
  const logDir = 'ci-logs';
  const logFiles: string[] = [];

  if (!existsSync(logDir)) {
    return logFiles;
  }

  // If SHA is provided, look in the commit-specific directory
  if (sha) {
    const shortSha = sha.substring(0, 7);
    const commitDir = `${logDir}/${shortSha}`;

    if (existsSync(commitDir)) {
      const files = readdirSync(commitDir);
      for (const file of files) {
        if (file.endsWith('.log') || file.endsWith('.txt')) {
          logFiles.push(`${commitDir}/${file}`);
        }
      }
    }
    return logFiles;
  }

  // Otherwise, find all log files in all commit directories
  try {
    const entries = readdirSync(logDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    for (const dir of dirs) {
      const commitDir = `${logDir}/${dir}`;
      try {
        const files = readdirSync(commitDir);
        for (const file of files) {
          if (file.endsWith('.log') || file.endsWith('.txt')) {
            logFiles.push(`${commitDir}/${file}`);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }
  } catch (error) {
    // Failed to read log directory
  }

  return logFiles;
}

function displayLogSummary(logFiles: string[]): void {
  logger.section('Log Files Available');

  if (logFiles.length === 0) {
    logger.warn('No log files found in ci-logs/');
    return;
  }

  for (const file of logFiles) {
    logger.info(`  📄 ${file}`);

    try {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n').length;
      const size = (content.length / 1024).toFixed(1);
      logger.info(`     ${lines} lines, ${size} KB`);
    } catch (error) {
      logger.warn(`     Could not read file`);
    }
  }
}

function displayLogErrors(logFiles: string[]): string[] {
  const errors: string[] = [];

  for (const file of logFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        if (line.includes('ERROR') || line.includes('❌') || line.includes('Failed')) {
          errors.push(`${file}: ${line.trim()}`);
        }
      }
    } catch (error) {
      // Skip if can't read
    }
  }

  if (errors.length > 0) {
    logger.section('Errors Found in Logs');
    for (const error of errors) {
      logger.error(error);
    }
  }

  return errors;
}

async function checkPipeline(skipWait = false, timeoutSeconds = 60): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    logger.section('Pipeline Status Checker');

    // Get current context
    const branch = await getCurrentBranch();
    const sha = await getLatestCommitSha();

    // Wait for logs to be pushed by CI (or just check once)
    const logsFound = await waitForLogs(branch, sha, timeoutSeconds, skipWait);

    // Find and display log files for this commit
    const logFiles = findLogFiles(sha);

    if (logFiles.length > 0) {
      displayLogSummary(logFiles);

      // Check for errors in logs
      const errors = displayLogErrors(logFiles);

      const duration = Math.floor((Date.now() - startTime) / 1000);

      logger.section('Final Result');
      if (errors.length === 0) {
        logger.success(`Pipeline passed! (${duration}s)`);
      } else {
        logger.error(`Pipeline failed with ${errors.length} error(s) (${duration}s)`);
      }

      return {
        success: errors.length === 0,
        duration,
        conclusion: errors.length === 0 ? 'success' : 'failure',
        logFiles,
        errors,
      };
    } else {
      const duration = Math.floor((Date.now() - startTime) / 1000);

      logger.section('Final Result');
      if (skipWait) {
        logger.warn(`No logs found yet - workflow may still be running (${duration}s)`);
      } else {
        logger.warn(`Timeout waiting for logs (${duration}s)`);
      }

      return {
        success: false,
        duration,
        conclusion: 'unknown',
        logFiles: [],
        errors: ['No logs found - workflow may not have run or is still in progress'],
      };
    }

  } catch (error) {
    logger.error(`Pipeline check failed: ${error}`);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const displayHelp = args.includes('--help') || args.includes('-h');
const noWait = args.includes('--no-wait');

// Parse timeout argument
let timeoutSeconds = 60; // default
const timeoutIndex = args.findIndex(arg => arg === '--timeout' || arg === '-t');
if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
  const parsedTimeout = parseInt(args[timeoutIndex + 1], 10);
  if (!isNaN(parsedTimeout) && parsedTimeout > 0) {
    timeoutSeconds = parsedTimeout;
  } else {
    console.error('Error: Invalid timeout value. Must be a positive number.');
    process.exit(1);
  }
}

if (displayHelp) {
  console.log(`
Pipeline Status Checker

Usage:
  bun run check-pipeline.ts [options]

Options:
  -h, --help              Show this help message
  --no-wait               Don't wait for completion, just check current status
  -t, --timeout <seconds> Timeout in seconds (default: 60)

Description:
  This script waits for GitHub Actions workflows to push CI logs for the
  current commit. It periodically pulls the branch and checks for logs in
  ci-logs/<commit-sha>/.

  Once logs are found, it analyzes them for errors and reports the result.

How it works:
  1. Gets current branch and commit SHA
  2. Polls by pulling the branch every 10 seconds
  3. Checks if ci-logs/<commit-sha>/ directory exists
  4. Once found, analyzes log files for errors
  5. Reports success or failure based on log analysis

Examples:
  # Check pipeline status for current commit
  bun run check-pipeline.ts

  # Just check logs without waiting
  bun run check-pipeline.ts --no-wait

  # Wait up to 2 minutes
  bun run check-pipeline.ts --timeout 120

  # After pushing a commit
  git push && bun run check-pipeline.ts
`);
  process.exit(0);
}

// Run the checker
checkPipeline(noWait, timeoutSeconds)
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
