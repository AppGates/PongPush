#!/usr/bin/env bun

/**
 * Pipeline Status Checker (GitHub API Version)
 * Uses GitHub REST API to check workflow status and download artifacts
 * Does not rely on checked-in pipeline results
 */

import { spawnGitCommand } from './utils/process';
import { Logger } from './utils/logger';
import { existsSync, mkdirSync, writeFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

interface WorkflowJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string;
  completed_at: string | null;
}

interface CheckResult {
  success: boolean;
  duration: number;
  conclusion: string;
  workflowRuns: WorkflowRun[];
  errors: string[];
  artifactDownloaded: boolean;
}

const logger = new Logger({ prefix: 'PipelineCheck' });

// Repository owner and name (parsed from git remote)
let REPO_OWNER = '';
let REPO_NAME = '';

/**
 * Parse repository owner and name from git remote URL
 */
async function parseRepoInfo(): Promise<void> {
  const result = await spawnGitCommand(['remote', 'get-url', 'origin'], logger);
  if (!result.success) {
    throw new Error('Failed to get git remote URL');
  }

  const url = result.stdout;
  // Match patterns like:
  // https://github.com/owner/repo.git
  // git@github.com:owner/repo.git
  // http://local_proxy@127.0.0.1:25933/git/AppGates/PongPush

  const httpsMatch = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  const sshMatch = url.match(/github\.com:([^\/]+)\/([^\/\.]+)/);
  const localMatch = url.match(/git\/([^\/]+)\/([^\/\.]+)/);

  let match = httpsMatch || sshMatch || localMatch;

  if (!match) {
    throw new Error(`Could not parse repository info from URL: ${url}`);
  }

  REPO_OWNER = match[1];
  REPO_NAME = match[2].replace(/\.git$/, '');

  logger.debug(`Repository: ${REPO_OWNER}/${REPO_NAME}`);
}

/**
 * Get current commit SHA
 */
async function getLatestCommitSha(): Promise<string> {
  const result = await spawnGitCommand(['rev-parse', 'HEAD'], logger);
  if (!result.success) {
    throw new Error('Failed to get commit SHA');
  }
  return result.stdout;
}

/**
 * Get current branch name
 */
async function getCurrentBranch(): Promise<string> {
  const result = await spawnGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], logger);
  if (!result.success) {
    throw new Error('Failed to get current branch');
  }
  return result.stdout;
}

/**
 * Fetch workflow runs for a specific commit from GitHub API
 */
async function fetchWorkflowRuns(sha: string): Promise<WorkflowRun[]> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs?head_sha=${sha}`;

  logger.debug(`Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PongPush-Pipeline-Checker',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { workflow_runs?: WorkflowRun[] };
  return data.workflow_runs || [];
}

/**
 * Fetch jobs for a specific workflow run
 */
async function fetchWorkflowJobs(runId: number): Promise<WorkflowJob[]> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}/jobs`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PongPush-Pipeline-Checker',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { jobs?: WorkflowJob[] };
  return data.jobs || [];
}

/**
 * Fetch artifacts for a workflow run
 */
async function fetchArtifacts(runId: number): Promise<any[]> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}/artifacts`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'PongPush-Pipeline-Checker',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { artifacts?: any[] };
  return data.artifacts || [];
}

/**
 * Download an artifact (requires authentication)
 */
async function downloadArtifact(artifactId: number, artifactName: string, sha: string): Promise<boolean> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/artifacts/${artifactId}/zip`;

  logger.info(`Downloading artifact: ${artifactName}`);

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PongPush-Pipeline-Checker',
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        logger.warn(`Cannot download artifacts: Authentication required`);
        logger.warn(`Artifacts can be downloaded manually from: https://github.com/${REPO_OWNER}/${REPO_NAME}/actions`);
        return false;
      }
      throw new Error(`Failed to download artifact: ${response.status} ${response.statusText}`);
    }

    // Create artifacts directory
    const artifactsDir = join('artifacts', sha.substring(0, 7));
    if (!existsSync(artifactsDir)) {
      mkdirSync(artifactsDir, { recursive: true });
    }

    // Save artifact
    const artifactPath = join(artifactsDir, `${artifactName}.zip`);
    const buffer = await response.arrayBuffer();
    writeFileSync(artifactPath, Buffer.from(buffer));

    logger.success(`Saved to: ${artifactPath}`);
    return true;
  } catch (error) {
    logger.error(`Failed to download artifact: ${error}`);
    return false;
  }
}

/**
 * Download logs for a workflow run
 * GitHub returns logs as a zip file containing log files for each job
 */
async function downloadWorkflowLogs(runId: number, sha: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}/logs`;

  logger.info(`Downloading workflow logs...`);

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'PongPush-Pipeline-Checker',
      },
      redirect: 'follow', // GitHub redirects to the actual log URL
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        logger.warn(`Cannot download logs: Authentication required`);
        logger.warn(`Logs can be viewed manually at: https://github.com/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}`);
        return null;
      }
      throw new Error(`Failed to download logs: ${response.status} ${response.statusText}`);
    }

    // Create ci-logs directory
    const shortSha = sha.substring(0, 7);
    const logsDir = join('ci-logs', shortSha);
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }

    // Save logs as zip
    const zipPath = join(logsDir, `logs-${runId}.zip`);
    const buffer = await response.arrayBuffer();
    writeFileSync(zipPath, Buffer.from(buffer));

    logger.success(`Logs saved to: ${zipPath}`);

    // Extract the zip
    await extractLogsZip(zipPath, logsDir);

    return logsDir;
  } catch (error) {
    logger.error(`Failed to download logs: ${error}`);
    return null;
  }
}

/**
 * Extract logs zip file using Bun's built-in unzip
 */
async function extractLogsZip(zipPath: string, outputDir: string): Promise<void> {
  try {
    logger.info(`Extracting logs...`);

    // Use Bun's spawn to unzip
    const proc = Bun.spawn(['unzip', '-o', zipPath, '-d', outputDir], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await proc.exited;

    logger.success(`Logs extracted to: ${outputDir}`);
  } catch (error) {
    logger.warn(`Could not extract logs: ${error}`);
  }
}

/**
 * Parse log files and find error lines
 */
async function parseLogsForErrors(logsDir: string): Promise<string[]> {
  const errors: string[] = [];

  try {
    if (!existsSync(logsDir)) {
      return errors;
    }

    const { readdirSync, readFileSync } = await import('fs');
    const files = readdirSync(logsDir);

    for (const file of files) {
      if (!file.endsWith('.txt') && !file.endsWith('.log')) {
        continue;
      }

      const filePath = join(logsDir, file);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Look for common error patterns
          if (
            line.includes('Error:') ||
            line.includes('ERROR') ||
            line.includes('Failed') ||
            line.includes('FAILED') ||
            line.match(/error TS\d+:/) || // TypeScript errors
            line.includes('❌')
          ) {
            // Include context: the error line and a few lines around it
            const context: string[] = [];
            const start = Math.max(0, i - 1);
            const end = Math.min(lines.length, i + 2);

            for (let j = start; j < end; j++) {
              context.push(lines[j].trim());
            }

            errors.push(`${file}:\n  ${context.join('\n  ')}`);

            // Limit to avoid overwhelming output
            if (errors.length >= 10) {
              errors.push('... (more errors in log files)');
              return errors;
            }
          }
        }
      } catch (err) {
        // Skip files we can't read
      }
    }
  } catch (error) {
    logger.warn(`Could not parse logs: ${error}`);
  }

  return errors;
}

/**
 * Wait for all workflow runs to complete
 */
async function waitForWorkflows(sha: string, timeoutSeconds: number, skipWait: boolean): Promise<WorkflowRun[]> {
  const startTime = Date.now();
  const pollInterval = 10000; // 10 seconds
  const shortSha = sha.substring(0, 7);

  logger.section('Waiting for Workflow Runs');
  logger.info(`Commit: ${shortSha}`);
  logger.info(`Repository: ${REPO_OWNER}/${REPO_NAME}`);

  if (skipWait) {
    logger.info('Checking current status only (no waiting)');
  } else {
    logger.info(`Timeout: ${timeoutSeconds}s`);
    logger.info(`Poll interval: ${pollInterval / 1000}s`);
  }
  logger.info('');

  while (true) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    // Fetch workflow runs from GitHub API
    const runs = await fetchWorkflowRuns(sha);

    if (runs.length === 0) {
      logger.warn('No workflow runs found for this commit yet');

      if (skipWait || elapsed >= timeoutSeconds) {
        return [];
      }

      logger.info(`[${elapsed}s] Waiting for workflows to start...`);
      await Bun.sleep(pollInterval);
      continue;
    }

    // Check status
    const inProgress = runs.filter(r => r.status === 'in_progress' || r.status === 'queued' || r.status === 'waiting');
    const completed = runs.filter(r => r.status === 'completed');

    logger.info(`[${elapsed}s] Workflows: ${completed.length}/${runs.length} completed`);

    for (const run of runs) {
      const status = run.status === 'completed' ? run.conclusion || 'unknown' : run.status;
      const icon = run.conclusion === 'success' ? '✅' :
                   run.conclusion === 'failure' ? '❌' :
                   run.conclusion === 'cancelled' ? '🚫' :
                   run.status === 'in_progress' ? '🔄' :
                   run.status === 'queued' ? '⏳' : '❓';

      logger.info(`  ${icon} ${run.name}: ${status}`);
    }

    // All workflows complete?
    if (inProgress.length === 0) {
      logger.success('All workflows completed!');
      logger.info('');
      return runs;
    }

    if (skipWait) {
      logger.warn(`${inProgress.length} workflow(s) still in progress`);
      return runs;
    }

    if (elapsed >= timeoutSeconds) {
      logger.warn(`Timeout after ${timeoutSeconds}s - ${inProgress.length} workflow(s) still in progress`);
      return runs;
    }

    // Wait before next check
    await Bun.sleep(pollInterval);
  }
}

/**
 * Display detailed job information for failed workflows
 */
async function displayFailedWorkflowDetails(run: WorkflowRun): Promise<void> {
  logger.subsection(`Failed Workflow: ${run.name}`);
  logger.info(`URL: ${run.html_url}`);
  logger.info(`Status: ${run.status}`);
  logger.info(`Conclusion: ${run.conclusion}`);
  logger.info('');

  // Fetch jobs for this workflow
  try {
    const jobs = await fetchWorkflowJobs(run.id);
    const failedJobs = jobs.filter(j => j.conclusion === 'failure');

    if (failedJobs.length > 0) {
      logger.info('Failed jobs:');
      for (const job of failedJobs) {
        logger.error(`  ❌ ${job.name}`);
      }
      logger.info('');
    }
  } catch (error) {
    logger.warn(`Could not fetch job details: ${error}`);
  }
}

/**
 * Main pipeline check function
 */
async function checkPipeline(skipWait = false, timeoutSeconds = 600): Promise<CheckResult> {
  const startTime = Date.now();

  try {
    logger.section('Pipeline Status Checker (GitHub API)');

    // Parse repository info from git remote
    await parseRepoInfo();

    // Get current context
    const branch = await getCurrentBranch();
    const sha = await getLatestCommitSha();
    const shortSha = sha.substring(0, 7);

    logger.info(`Branch: ${branch}`);
    logger.info('');

    // Wait for workflows to complete
    const runs = await waitForWorkflows(sha, timeoutSeconds, skipWait);

    if (runs.length === 0) {
      logger.warn('No workflow runs found');
      return {
        success: false,
        duration: Math.floor((Date.now() - startTime) / 1000),
        conclusion: 'no_runs',
        workflowRuns: [],
        errors: ['No workflow runs found for this commit'],
        artifactDownloaded: false,
      };
    }

    // Analyze results
    const failed = runs.filter(r => r.conclusion === 'failure');
    const cancelled = runs.filter(r => r.conclusion === 'cancelled');
    const success = runs.filter(r => r.conclusion === 'success');
    const inProgress = runs.filter(r => r.status !== 'completed');

    const allComplete = inProgress.length === 0;
    const allSuccess = allComplete && failed.length === 0 && cancelled.length === 0;

    const duration = Math.floor((Date.now() - startTime) / 1000);

    logger.section('Final Result');

    // Success case
    if (allSuccess) {
      logger.success(`✅ All workflows passed! (${duration}s)`);
      return {
        success: true,
        duration,
        conclusion: 'success',
        workflowRuns: runs,
        errors: [],
        artifactDownloaded: false,
      };
    }

    // Failure case
    let artifactDownloaded = false;
    const logsDirs: string[] = [];
    const allErrors: string[] = [];

    if (failed.length > 0) {
      logger.error(`❌ ${failed.length} workflow(s) failed (${duration}s)`);
      logger.info('');

      // Display details for each failed workflow
      for (const run of failed) {
        await displayFailedWorkflowDetails(run);

        // Download logs for failed workflow
        const logsDir = await downloadWorkflowLogs(run.id, sha);
        if (logsDir) {
          logsDirs.push(logsDir);
          logger.info('');

          // Parse logs for errors
          const errors = await parseLogsForErrors(logsDir);
          if (errors.length > 0) {
            logger.subsection('Key Errors Found');
            for (const error of errors) {
              logger.error(error);
              logger.info('');
            }
            allErrors.push(...errors);
          }
        }

        // Try to download artifacts for failed workflows
        try {
          const artifacts = await fetchArtifacts(run.id);
          if (artifacts.length > 0) {
            logger.info(`Found ${artifacts.length} artifact(s):`);
            for (const artifact of artifacts) {
              logger.info(`  📦 ${artifact.name} (${(artifact.size_in_bytes / 1024).toFixed(1)} KB)`);

              // Attempt to download (may fail due to auth)
              const downloaded = await downloadArtifact(artifact.id, artifact.name, sha);
              if (downloaded) {
                artifactDownloaded = true;
              }
            }
            logger.info('');
          }
        } catch (error) {
          logger.warn(`Could not fetch artifacts: ${error}`);
        }
      }

      // Display summary of where to find logs
      if (logsDirs.length > 0) {
        logger.section('Logs Location');
        logger.info('Downloaded logs are available at:');
        for (const dir of logsDirs) {
          logger.info(`  📁 ${dir}/`);
        }
        logger.info('');
      }

      return {
        success: false,
        duration,
        conclusion: 'failure',
        workflowRuns: runs,
        errors: failed.map(r => `Workflow '${r.name}' failed`),
        artifactDownloaded,
      };
    }

    // Cancelled case
    if (cancelled.length > 0) {
      logger.warn(`🚫 ${cancelled.length} workflow(s) cancelled (${duration}s)`);
      return {
        success: false,
        duration,
        conclusion: 'cancelled',
        workflowRuns: runs,
        errors: cancelled.map(r => `Workflow '${r.name}' was cancelled`),
        artifactDownloaded: false,
      };
    }

    // In progress / timeout case
    if (inProgress.length > 0) {
      logger.warn(`⏱️  ${inProgress.length} workflow(s) still in progress (${duration}s)`);
      logger.info(`In progress: ${inProgress.map(r => r.name).join(', ')}`);

      return {
        success: false,
        duration,
        conclusion: 'pending',
        workflowRuns: runs,
        errors: inProgress.map(r => `Workflow '${r.name}' did not complete`),
        artifactDownloaded: false,
      };
    }

    // Unknown state
    return {
      success: false,
      duration,
      conclusion: 'unknown',
      workflowRuns: runs,
      errors: ['Unknown pipeline state'],
      artifactDownloaded: false,
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

// Parse timeout argument (default to 600s = 10 minutes for API version)
let timeoutSeconds = 600;
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
Pipeline Status Checker (GitHub API Version)

Usage:
  bun run check-pipeline-api.ts [options]

Options:
  -h, --help              Show this help message
  --no-wait               Don't wait for completion, just check current status
  -t, --timeout <seconds> Timeout in seconds (default: 600)

Description:
  This script checks GitHub Actions workflow status using the GitHub REST API.
  It does not rely on checked-in pipeline results or status files.

  Features:
  - Fetches workflow runs directly from GitHub API
  - Polls API every 10 seconds until all workflows complete
  - Downloads job logs for failed workflows to ci-logs/<commit-sha>/
  - Parses logs and highlights key errors
  - Downloads artifacts for failed workflows (if authenticated)
  - Displays detailed job information for failures

How it works:
  1. Gets current branch and commit SHA
  2. Fetches workflow runs for the commit from GitHub API
  3. Polls every 10 seconds until all workflows complete
  4. For failures:
     - Downloads job logs to ci-logs/<commit-sha>/
     - Extracts and parses logs for errors
     - Downloads artifacts to artifacts/<commit-sha>/
     - Shows where to find all downloaded files

Authentication:
  - Read-only operations (checking status, downloading logs) work without authentication
  - Downloading artifacts may require GitHub authentication
  - Set GITHUB_TOKEN environment variable for full access

Examples:
  # Check pipeline status for current commit
  bun run check-pipeline-api.ts

  # Just check current status without waiting
  bun run check-pipeline-api.ts --no-wait

  # Wait up to 20 minutes
  bun run check-pipeline-api.ts --timeout 1200

  # After pushing a commit
  git push && bun run check-pipeline-api.ts

  # With authentication for artifact downloads
  GITHUB_TOKEN=ghp_xxx bun run check-pipeline-api.ts
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
