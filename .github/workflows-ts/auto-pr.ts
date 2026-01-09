#!/usr/bin/env bun

/**
 * Auto PR Workflow
 * Automatically creates a PR for claude/** branches and enables auto-merge
 *
 * Logs are organized by commit SHA and automatically cleaned up
 */

import { Logger } from './utils/logger';
import { GitHubClient } from './utils/github';
import { GitClient } from './utils/git';
import { cleanupOldLogs, ensureCommitLogDir } from './utils/log-cleanup';
import * as path from 'path';

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

async function cleanupStaleBranches(
  ctx: WorkflowContext,
  git: GitClient,
  github: GitHubClient,
  logger: Logger
): Promise<void> {
  try {
    // Get all remote claude branches
    const result = await git.getCurrentBranch();  // Just to test git is working

    // Use a direct spawn to get branch list
    const { spawnProcess } = await import('./utils/process');
    const branchResult = await spawnProcess(
      ['git', 'branch', '-r'],
      logger,
      { logCommand: false }
    );

    if (!branchResult.success) {
      logger.warn('Could not list branches for cleanup');
      return;
    }

    const allBranches = branchResult.stdout
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('origin/claude/'))
      .map(line => line.replace('origin/', ''));

    logger.info(`Found ${allBranches.length} claude branches to check`);

    // Skip current branch
    const otherBranches = allBranches.filter(b => b !== ctx.branch);

    if (otherBranches.length === 0) {
      logger.info('No other branches to check');
      return;
    }

    logger.info(`Checking ${otherBranches.length} other branches for cleanup`);

    let deleted = 0;
    let kept = 0;

    for (const branch of otherBranches) {
      const hasCommits = await git.hasCommitsAhead('origin/main', `origin/${branch}`);

      if (!hasCommits) {
        logger.info(`  ❌ ${branch}: no commits ahead, deleting...`);
        const success = await git.deleteBranch('origin', branch);
        if (success) {
          deleted++;
        }
      } else {
        logger.debug(`  ✅ ${branch}: has commits, keeping`);
        kept++;
      }
    }

    logger.info(`Cleanup complete: ${deleted} deleted, ${kept} kept`);
  } catch (error) {
    logger.warn(`Branch cleanup failed: ${error}`);
    // Don't fail the whole workflow if cleanup fails
  }
}

async function main() {
  try {
    // Get workflow context first (need SHA for log directory)
    const ctx = await getWorkflowContext();

    // Setup log directory structure
    const baseLogDir = 'ci-logs';
    const commitLogDir = ensureCommitLogDir(baseLogDir, ctx.sha,
      new Logger({ prefix: 'Setup' }));

    // Initialize logger with commit-specific directory
    const logger = new Logger({
      logFile: path.join(commitLogDir, 'auto-pr.log'),
      prefix: 'AutoPR',
    });

    logger.section('Auto PR Workflow Started');
    logger.info(`Timestamp: ${new Date().toISOString()}`);
    logger.info(`Commit: ${ctx.sha}`);
    logger.info('');

    // Clean up old log directories
    await cleanupOldLogs({
      logDir: baseLogDir,
      currentCommit: ctx.sha,
    }, logger);
    logger.info('');

    // Initialize clients (needed for cleanup and PR operations)
    const github = new GitHubClient(ctx.token, ctx.repository, logger);
    const git = new GitClient(logger);

    // Clean up stale branches (branches with no commits ahead of main)
    logger.section('Cleaning Up Stale Branches');
    await cleanupStaleBranches(ctx, git, github, logger);
    logger.info('');

    logger.section('Branch Information');
    logger.info(`Branch: ${ctx.branch}`);
    logger.info(`Ref: ${ctx.ref}`);
    logger.info('');

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

    // Check if branch has commits ahead of main
    logger.section('Checking Branch Status');
    await git.fetch('origin', 'main');
    const hasCommits = await git.hasCommitsAhead('origin/main', 'HEAD');

    if (!hasCommits) {
      logger.warn('Branch has no commits ahead of main');

      // Check if there's a merged PR to clean up
      const prNumber = await github.findPullRequest(ctx.branch);
      if (prNumber) {
        const prDetails = await github.getPullRequestDetails(prNumber);
        if (prDetails && prDetails.state === 'MERGED') {
          logger.info(`PR #${prNumber} is already merged, deleting branch`);
        } else {
          logger.info('Branch is up-to-date with main, deleting branch');
        }
      } else {
        logger.info('No commits to create PR, deleting branch');
      }

      // Delete the branch
      const deleted = await git.deleteBranch('origin', ctx.branch);
      if (deleted) {
        logger.success('Branch deleted successfully');
      } else {
        logger.warn('Branch deletion failed, but continuing');
      }

      logger.section('Workflow Complete');
      process.exit(0);
    }

    logger.info(`Branch has commits ahead of main`);
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

        // If PR is merged, delete the branch
        if (prDetails.state === 'MERGED') {
          logger.info('');
          logger.subsection('Cleaning Up Merged Branch');
          const deleted = await git.deleteBranch('origin', ctx.branch);
          if (deleted) {
            logger.success('Merged branch deleted successfully');
          } else {
            logger.warn('Branch deletion failed');
          }
          logger.section('Workflow Complete');
          process.exit(0);
        }
      }
    } else {
      logger.info('No existing PR found. Creating new PR...');

      // Get commit message for PR title
      const commitMsg = await git.getLatestCommitMessage();
      logger.info(`Commit message: ${commitMsg}`);

      // Get commit log for PR body (main branch already fetched)
      const commitLog = await git.getCommitLog('origin/main', 'HEAD', 'oneline');

      // Create PR body
      const prBodyParts = [
        '## Automated PR',
        '',
        'This PR was automatically created from a claude/** branch.',
        '',
        '### Changes',
      ];

      if (commitLog.length > 0) {
        prBodyParts.push(...commitLog, '');
      } else {
        prBodyParts.push('- ' + commitMsg, '');
      }

      prBodyParts.push(
        '---',
        '**Auto-merge**: This PR will automatically merge when all checks pass.'
      );

      const prBody = prBodyParts.join('\n');

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
    process.exit(1);
  }
}

// Run main
main();
