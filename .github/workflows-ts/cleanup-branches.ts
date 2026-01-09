#!/usr/bin/env bun

/**
 * Branch Cleanup Script
 * Deletes all claude/** branches that have no commits ahead of main
 */

import { Logger } from './utils/logger';
import { GitClient } from './utils/git';
import { spawnProcess } from './utils/process';

const logger = new Logger({ prefix: 'Cleanup' });

interface BranchInfo {
  name: string;
  commitsAhead: number;
}

async function getAllClaudeBranches(): Promise<string[]> {
  logger.section('Finding Claude Branches');

  const result = await spawnProcess(
    ['git', 'branch', '-r'],
    logger,
    { logCommand: false }
  );

  if (!result.success) {
    logger.error('Failed to list branches');
    return [];
  }

  const branches = result.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('origin/claude/'))
    .map(line => line.replace('origin/', ''));

  logger.info(`Found ${branches.length} claude branches`);
  return branches;
}

async function getBranchInfo(branch: string, git: GitClient): Promise<BranchInfo> {
  const hasCommits = await git.hasCommitsAhead('origin/main', `origin/${branch}`);

  // Get actual count for display
  const result = await spawnProcess(
    ['git', 'rev-list', '--count', `origin/main..origin/${branch}`],
    logger,
    { logCommand: false }
  );

  const commitsAhead = result.success ? parseInt(result.stdout, 10) : -1;

  return { name: branch, commitsAhead };
}

async function main() {
  logger.section('Branch Cleanup Started');
  logger.info(`Timestamp: ${new Date().toISOString()}`);
  logger.info('');

  const git = new GitClient(logger);

  // Fetch latest from origin
  logger.subsection('Fetching Latest Changes');
  await git.fetch('origin', 'main');
  await git.fetch('origin');
  logger.info('');

  // Get all claude branches
  const branches = await getAllClaudeBranches();

  if (branches.length === 0) {
    logger.info('No claude branches found');
    return;
  }

  logger.info('');

  // Check each branch
  logger.section('Analyzing Branches');
  const branchInfos: BranchInfo[] = [];

  for (const branch of branches) {
    const info = await getBranchInfo(branch, git);
    branchInfos.push(info);

    if (info.commitsAhead === 0) {
      logger.info(`❌ ${branch}: ${info.commitsAhead} commits ahead (will delete)`);
    } else if (info.commitsAhead > 0) {
      logger.info(`✅ ${branch}: ${info.commitsAhead} commits ahead (keep)`);
    } else {
      logger.warn(`⚠️  ${branch}: Could not determine status`);
    }
  }

  logger.info('');

  // Delete branches with no commits ahead
  const toDelete = branchInfos.filter(b => b.commitsAhead === 0);

  if (toDelete.length === 0) {
    logger.success('No branches to delete');
    logger.section('Cleanup Complete');
    return;
  }

  logger.section(`Deleting ${toDelete.length} Branch(es)`);

  let deleted = 0;
  let failed = 0;

  for (const branch of toDelete) {
    const success = await git.deleteBranch('origin', branch.name);
    if (success) {
      deleted++;
    } else {
      failed++;
    }
  }

  logger.info('');
  logger.success(`Deleted: ${deleted} branch(es)`);
  if (failed > 0) {
    logger.warn(`Failed: ${failed} branch(es)`);
  }

  logger.info('');
  logger.section('Cleanup Complete');
}

main().catch(error => {
  logger.error(`Cleanup failed: ${error}`);
  process.exit(1);
});
