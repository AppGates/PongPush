#!/usr/bin/env bun

/**
 * Pipeline Status Checker
 * Waits for workflow runs to complete and displays results
 */

import { spawnGhCommand, spawnGitCommand } from './utils/process';
import { Logger } from './utils/logger';
import { readFileSync, existsSync, readdirSync } from 'fs';

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
}

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

async function getWorkflowRuns(branch: string, sha: string): Promise<WorkflowRun[]> {
  try {
    const result = await spawnGhCommand(
      ['run', 'list', '--branch', branch, '--json', 'databaseId,name,status,conclusion,headSha,createdAt,url'],
      process.env.GITHUB_TOKEN || '',
      logger
    );

    if (!result.success) {
      logger.warn(`gh CLI not available or failed: ${result.stderr}`);
      return [];
    }

    const runs = JSON.parse(result.stdout);

    // Filter runs for this specific commit
    return runs
      .filter((run: any) => run.headSha === sha)
      .map((run: any) => ({
        id: run.databaseId,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        html_url: run.url,
        created_at: run.createdAt,
      }));
  } catch (error) {
    logger.warn(`Cannot query GitHub API: ${error}`);
    return [];
  }
}

async function waitForCompletion(branch: string, sha: string, timeoutSeconds = 60, skipWait = false): Promise<WorkflowRun[]> {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  logger.section('Checking Workflow Status');
  logger.info(`Branch: ${branch}`);
  logger.info(`Commit: ${sha.substring(0, 7)}`);

  if (skipWait) {
    logger.info('Checking current status only (no waiting)');
  } else {
    logger.info(`Timeout: ${timeoutSeconds}s`);
  }
  logger.info('');

  while (true) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    if (elapsed > timeoutSeconds && !skipWait) {
      logger.error(`Timeout after ${timeoutSeconds}s`);
      throw new Error('Workflow check timeout');
    }

    const runs = await getWorkflowRuns(branch, sha);

    if (runs.length === 0) {
      if (skipWait) {
        logger.warn('No workflow runs found for this commit (gh CLI may not be available)');
        return [];
      }
      logger.info(`[${elapsed}s] No workflow runs found yet, waiting...`);
      await Bun.sleep(pollInterval);
      continue;
    }

    // Check if all runs are complete
    const allComplete = runs.every(run => run.status === 'completed');
    const inProgress = runs.filter(run => run.status === 'in_progress').length;
    const queued = runs.filter(run => run.status === 'queued').length;
    const completed = runs.filter(run => run.status === 'completed').length;

    logger.info(`[${elapsed}s] Workflows: ${completed} completed, ${inProgress} in progress, ${queued} queued`);

    if (allComplete || skipWait) {
      if (allComplete) {
        logger.success('All workflows completed!');
      }
      logger.info('');
      return runs;
    }

    await Bun.sleep(pollInterval);
  }
}

async function pullLogsFromBranch(branch: string): Promise<boolean> {
  logger.section('Pulling Logs from Branch');

  try {
    const result = await spawnGitCommand(['pull', 'origin', branch], logger);
    if (!result.success) {
      logger.error(`Failed to pull: ${result.stderr}`);
      return false;
    }

    logger.success('Logs pulled successfully');
    return true;
  } catch (error) {
    logger.error(`Failed to pull logs: ${error}`);
    return false;
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

function displayRunSummary(runs: WorkflowRun[]): void {
  logger.section('Workflow Run Summary');

  for (const run of runs) {
    const icon = run.conclusion === 'success' ? '✅' :
                 run.conclusion === 'failure' ? '❌' :
                 run.conclusion === 'cancelled' ? '⚠️' : '❓';

    logger.info(`${icon} ${run.name}`);
    logger.info(`   Status: ${run.status}`);
    logger.info(`   Conclusion: ${run.conclusion || 'N/A'}`);
    logger.info(`   URL: ${run.html_url}`);
    logger.info('');
  }
}

async function checkPipeline(skipWait = false): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    logger.section('Pipeline Status Checker');

    // Get current context
    const branch = await getCurrentBranch();
    const sha = await getLatestCommitSha();

    // Wait for workflows to complete (or just check once)
    const runs = await waitForCompletion(branch, sha, 60, skipWait);

    // Display run summary if we have runs
    if (runs.length > 0) {
      displayRunSummary(runs);
    }

    // Pull logs from branch
    await pullLogsFromBranch(branch);

    // Find and display log files for this commit
    const logFiles = findLogFiles(sha);
    displayLogSummary(logFiles);

    // Check for errors
    const errors = displayLogErrors(logFiles);

    // Determine overall success
    const allSuccess = runs.length === 0 || runs.every(run => run.conclusion === 'success');
    const duration = Math.floor((Date.now() - startTime) / 1000);

    logger.section('Final Result');
    if (runs.length === 0) {
      if (errors.length === 0) {
        logger.info(`No workflow API data available, logs look clean (${duration}s)`);
      } else {
        logger.warn(`No workflow API data, but errors found in logs (${duration}s)`);
      }
    } else if (allSuccess && errors.length === 0) {
      logger.success(`All workflows passed! (${duration}s)`);
    } else if (!allSuccess) {
      logger.error(`Some workflows failed! (${duration}s)`);
    } else {
      logger.warn(`Workflows passed but errors found in logs (${duration}s)`);
    }

    return {
      success: allSuccess && errors.length === 0,
      duration,
      conclusion: allSuccess ? 'success' : 'failure',
      logFiles,
      errors,
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

if (displayHelp) {
  console.log(`
Pipeline Status Checker

Usage:
  bun run check-pipeline.ts [options]

Options:
  -h, --help     Show this help message
  --no-wait      Don't wait for completion, just check current status

Description:
  This script waits for GitHub Actions workflows to complete for the
  current commit, pulls logs from the branch, and displays a summary.

  If gh CLI is not available, it will skip workflow API checks and
  just analyze the log files in ci-logs/.

Environment:
  GITHUB_TOKEN   GitHub token for API access (optional, uses gh CLI)

Examples:
  # Check pipeline status for current commit
  bun run .github/workflows-ts/check-pipeline.ts

  # Just check logs without waiting
  bun run .github/workflows-ts/check-pipeline.ts --no-wait

  # After pushing a commit
  git push && bun run .github/workflows-ts/check-pipeline.ts
`);
  process.exit(0);
}

// Run the checker
checkPipeline(noWait)
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
