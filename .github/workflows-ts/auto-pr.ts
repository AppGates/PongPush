#!/usr/bin/env bun

/**
 * Auto PR Workflow
 * Automatically creates a PR for claude/** branches and enables auto-merge
 */

import { Logger } from './utils/logger';
import { GitHubClient } from './utils/github';
import { GitClient } from './utils/git';
import { LogPusher } from './utils/log-pusher';

interface WorkflowContext {
  sha: string;
  ref: string;
  branch: string;
  repository: string;
  token: string;
}

async function getWorkflowContext(): Promise<WorkflowContext> {
  const sha = process.env.GITHUB_SHA || '';
  const ref = process.env.GITHUB_REF || '';
  const repository = process.env.GITHUB_REPOSITORY || '';
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';

  // Extract branch name from ref (refs/heads/branch-name -> branch-name)
  const branch = ref.replace('refs/heads/', '');

  if (!sha || !ref || !repository || !token) {
    throw new Error('Missing required environment variables: GITHUB_SHA, GITHUB_REF, GITHUB_REPOSITORY, GH_TOKEN/GITHUB_TOKEN');
  }

  return { sha, ref, branch, repository, token };
}

async function main() {
  // Initialize logger
  const logger = new Logger({
    logFile: 'auto-pr.log',
    prefix: 'AutoPR',
  });

  logger.section('Auto PR Workflow Started');
  logger.info(`Timestamp: ${new Date().toISOString()}`);

  try {
    // Get workflow context
    const ctx = await getWorkflowContext();
    logger.info(`Commit: ${ctx.sha}`);
    logger.info('');

    logger.section('Branch Information');
    logger.info(`Branch: ${ctx.branch}`);
    logger.info(`Ref: ${ctx.ref}`);
    logger.info('');

    // Initialize clients
    const github = new GitHubClient(ctx.token, ctx.repository, logger);
    const git = new GitClient(logger);

    // Check repository settings
    logger.section('Checking Repository Settings');
    const settings = await github.getRepositorySettings();
    if (settings) {
      logger.info(`Auto-merge allowed: ${settings.allow_auto_merge}`);
      logger.info(`Merge commit allowed: ${settings.allow_merge_commit}`);
      logger.info(`Squash merge allowed: ${settings.allow_squash_merge}`);
      logger.info(`Rebase merge allowed: ${settings.allow_rebase_merge}`);
    }
    logger.info('');

    // Check if PR already exists
    logger.section('Checking for Existing PR');
    let prNumber = await github.findPullRequest(ctx.branch);

    if (prNumber) {
      logger.info(`PR #${prNumber} already exists for branch ${ctx.branch}`);

      // Get PR details
      logger.subsection('Existing PR Details');
      const prDetails = await github.getPullRequestDetails(prNumber);
      if (prDetails) {
        logger.info(`Title: ${prDetails.title}`);
        logger.info(`State: ${prDetails.state}`);
        logger.info(`Mergeable: ${prDetails.mergeable}`);
        logger.info(`Merge state: ${prDetails.mergeStateStatus}`);
        logger.info(`Auto-merge: ${prDetails.autoMergeRequest ? 'enabled' : 'disabled'}`);
      }
    } else {
      logger.info('No existing PR found. Creating new PR...');

      // Get commit message for PR title
      const commitMsg = await git.getLatestCommitMessage();
      logger.info(`Commit message: ${commitMsg}`);

      // Get commit log for PR body
      const commitLog = await git.getCommitLog('main', 'HEAD', 'oneline');

      // Create PR body
      const prBody = [
        '## Automated PR',
        '',
        'This PR was automatically created from a claude/** branch.',
        '',
        '### Changes',
        ...commitLog,
        '',
        '---',
        '**Auto-merge**: This PR will automatically merge when all checks pass.',
      ].join('\n');

      // Create PR
      logger.subsection('Creating PR');
      const result = await github.createPullRequest(
        commitMsg,
        prBody,
        'main',
        ctx.branch
      );

      if (result) {
        logger.success(`PR created: ${result.url}`);
        logger.info(`PR Number: ${result.number}`);
        prNumber = result.number;
      } else {
        logger.error('Failed to create PR');
        // Try to find PR another way
        logger.info('Attempting to find PR another way...');
        prNumber = await github.findPullRequest(ctx.branch);

        if (!prNumber) {
          logger.error('Could not find or create PR. Workflow cannot continue.');
          logger.section('Workflow Complete (with errors)');
          process.exit(0); // Exit gracefully so logs are pushed
        }
      }
    }

    // Only proceed if we have a PR number
    if (!prNumber) {
      logger.error('No PR number available. Cannot enable auto-merge.');
      process.exit(0);
    }

    // Enable auto-merge
    logger.section('Enabling Auto-Merge');
    logger.info(`Attempting to enable auto-merge for PR #${prNumber}...`);

    const autoMergeEnabled = await github.enableAutoMerge(prNumber, 'merge');
    if (autoMergeEnabled) {
      logger.success('Auto-merge enabled successfully');
    } else {
      logger.warn('Auto-merge command failed');
    }

    // Check PR status after attempting auto-merge
    logger.section('Final PR Status');
    const finalPrDetails = await github.getPullRequestDetails(prNumber);
    if (finalPrDetails) {
      logger.info(`Title: ${finalPrDetails.title}`);
      logger.info(`State: ${finalPrDetails.state}`);
      logger.info(`Mergeable: ${finalPrDetails.mergeable}`);
      logger.info(`Merge state: ${finalPrDetails.mergeStateStatus}`);
      logger.info(`Auto-merge: ${finalPrDetails.autoMergeRequest ? 'enabled' : 'disabled'}`);

      if (finalPrDetails.statusCheckRollup && finalPrDetails.statusCheckRollup.length > 0) {
        logger.subsection('Status Checks');
        for (const check of finalPrDetails.statusCheckRollup) {
          logger.info(`  - ${check.name || check.context}: ${check.state || check.status}`);
        }
      }
    }

    logger.info('');
    logger.section('Workflow Complete');

  } catch (error) {
    logger.error(`Workflow failed: ${error}`);
    logger.section('Workflow Complete (with errors)');
  } finally {
    // Always push logs
    try {
      const logPusher = new LogPusher(logger);
      await logPusher.pushLogs({
        logFile: logger.getLogFile(),
        jobName: 'auto-pr',
        outputLogName: 'auto-pr-output.log',
      });
    } catch (pushError) {
      logger.error(`Failed to push logs: ${pushError}`);
    }
  }
}

// Run main
main();
