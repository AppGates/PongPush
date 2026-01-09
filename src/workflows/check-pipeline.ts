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

interface JobStatus {
  name: string;
  status: 'success' | 'failed' | 'pending';
  statusFile?: string;
}

// Expected workflows for claude/** branches
const EXPECTED_WORKFLOWS = ['build', 'e2e-local', 'auto-pr'];

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

function getJobStatuses(sha: string): JobStatus[] {
  const shortSha = sha.substring(0, 7);
  const logDir = `ci-logs/${shortSha}`;

  return EXPECTED_WORKFLOWS.map(workflowName => {
    const statusFile = `${logDir}/${workflowName}.status`;

    if (!existsSync(statusFile)) {
      return { name: workflowName, status: 'pending' as const };
    }

    try {
      const content = readFileSync(statusFile, 'utf-8').trim();
      const status = content === 'success' ? 'success' : 'failed';
      return { name: workflowName, status, statusFile };
    } catch (error) {
      return { name: workflowName, status: 'pending' as const };
    }
  });
}

async function waitForAllJobs(branch: string, sha: string, timeoutSeconds = 60, skipWait = false): Promise<JobStatus[]> {
  const startTime = Date.now();
  const pollInterval = 10000; // 10 seconds
  const shortSha = sha.substring(0, 7);

  logger.section('Waiting for CI Jobs');
  logger.info(`Branch: ${branch}`);
  logger.info(`Commit: ${shortSha}`);
  logger.info(`Expected jobs: ${EXPECTED_WORKFLOWS.join(', ')}`);

  if (skipWait) {
    logger.info('Checking current status only (no waiting)');
  } else {
    logger.info(`Timeout: ${timeoutSeconds}s`);
    logger.info(`Poll interval: ${pollInterval / 1000}s`);
  }
  logger.info('');

  while (true) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    // Pull the branch to get latest commits with logs
    await pullBranch(branch);

    // Check status of all jobs
    const statuses = getJobStatuses(sha);
    const pending = statuses.filter(s => s.status === 'pending');
    const completed = statuses.filter(s => s.status !== 'pending');

    if (completed.length > 0) {
      logger.info(`[${elapsed}s] Jobs: ${completed.length}/${EXPECTED_WORKFLOWS.length} completed`);
      for (const job of completed) {
        const icon = job.status === 'success' ? '✅' : '❌';
        logger.info(`  ${icon} ${job.name}: ${job.status}`);
      }
    }

    // All jobs complete?
    if (pending.length === 0) {
      logger.success('All jobs completed!');
      logger.info('');
      return statuses;
    }

    if (skipWait) {
      logger.warn(`${pending.length} job(s) still pending: ${pending.map(j => j.name).join(', ')}`);
      return statuses;
    }

    if (elapsed >= timeoutSeconds) {
      logger.warn(`Timeout after ${timeoutSeconds}s - ${pending.length} job(s) still pending`);
      logger.info(`Pending: ${pending.map(j => j.name).join(', ')}`);
      return statuses;
    }

    if (completed.length === 0) {
      logger.info(`[${elapsed}s] No jobs completed yet, waiting...`);
    }

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
    const shortSha = sha.substring(0, 7);

    // Wait for all jobs to complete (or just check once)
    const jobStatuses = await waitForAllJobs(branch, sha, timeoutSeconds, skipWait);

    // Check overall status
    const failed = jobStatuses.filter(j => j.status === 'failed');
    const pending = jobStatuses.filter(j => j.status === 'pending');
    const success = jobStatuses.filter(j => j.status === 'success');
    const allComplete = pending.length === 0;
    const allSuccess = allComplete && failed.length === 0;

    const duration = Math.floor((Date.now() - startTime) / 1000);
    const logFiles = findLogFiles(sha);

    logger.section('Final Result');

    // Success case - very short report
    if (allSuccess) {
      logger.success(`✅ All jobs passed! (${duration}s)`);
      return {
        success: true,
        duration,
        conclusion: 'success',
        logFiles,
        errors: [],
      };
    }

    // Failure case - detailed report
    if (failed.length > 0) {
      logger.error(`❌ ${failed.length} job(s) failed (${duration}s)`);
      logger.info('');

      for (const job of failed) {
        logger.error(`Failed job: ${job.name}`);

        // List relevant log files for this job
        const jobLogFiles = logFiles.filter(f =>
          f.includes(shortSha) && (
            f.includes(job.name) ||
            f.includes('stdout.log') ||
            f.includes('stderr.log')
          )
        );

        if (jobLogFiles.length > 0) {
          logger.info(`  Relevant log files:`);
          for (const logFile of jobLogFiles) {
            logger.info(`    📄 ${logFile}`);
          }
        }
        logger.info('');
      }

      return {
        success: false,
        duration,
        conclusion: 'failure',
        logFiles,
        errors: failed.map(j => `Job '${j.name}' failed`),
      };
    }

    // Pending/timeout case
    if (pending.length > 0) {
      logger.warn(`⏱️  ${pending.length} job(s) still pending (${duration}s)`);
      logger.info(`Pending jobs: ${pending.map(j => j.name).join(', ')}`);

      return {
        success: false,
        duration,
        conclusion: 'pending',
        logFiles,
        errors: pending.map(j => `Job '${j.name}' did not complete`),
      };
    }

    // Shouldn't reach here
    return {
      success: false,
      duration,
      conclusion: 'unknown',
      logFiles,
      errors: ['Unknown pipeline state'],
    };

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
  This script waits for GitHub Actions jobs to complete by checking for
  semaphore status files written by each job in ci-logs/<commit-sha>/.

  Expected jobs for claude/** branches: ${EXPECTED_WORKFLOWS.join(', ')}

  Each job writes a <job-name>.status file containing "success" or "failed".
  The script polls the branch every 10 seconds until all status files appear.

  Reports:
  - Success: Very short report (just "All jobs passed!")
  - Failure: Detailed report with failed job names and relevant log files

How it works:
  1. Gets current branch and commit SHA
  2. Polls by pulling the branch every 10 seconds
  3. Checks for .status files for all expected jobs
  4. Once all complete, generates report based on results
  5. Success = short report, Failure = detailed with log paths

Examples:
  # Check pipeline status for current commit
  bun run check-pipeline.ts

  # Just check current status without waiting
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
