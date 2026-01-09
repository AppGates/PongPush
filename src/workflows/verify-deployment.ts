#!/usr/bin/env bun

import { Logger } from "./utils/logger";

/**
 * Verify Deployment workflow
 * - Waits for the correct commit to be deployed to GitHub Pages
 * - Checks if the site is accessible
 * - Verifies the commit SHA in the deployed page
 */

const SITE_URL = "https://appgates.github.io/PongPush/";
const EXPECTED_COMMIT = process.env.GITHUB_SHA || "";
const MAX_ATTEMPTS = 30;
const RETRY_DELAY = 10000; // 10 seconds in milliseconds

const logger = new Logger({
  logFile: process.env.WORKFLOW_LOG_FILE,
  prefix: "Verify"
});

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkSiteAccessible(): Promise<number> {
  try {
    const response = await fetch(SITE_URL);
    return response.status;
  } catch (error) {
    return 0;
  }
}

async function checkCommitDeployed(): Promise<boolean> {
  try {
    const response = await fetch(SITE_URL);
    const html = await response.text();
    return html.includes(`id="commit-${EXPECTED_COMMIT}"`);
  } catch (error) {
    return false;
  }
}

async function main() {
  logger.info("");
  logger.section("Verify Deployment Workflow");
  logger.info(`Timestamp: ${new Date().toISOString()}`);
  logger.info(`Expected commit: ${EXPECTED_COMMIT}`);
  logger.info(`Site URL: ${SITE_URL}`);
  logger.info("");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    logger.info(`Attempt ${attempt}/${MAX_ATTEMPTS}: Checking deployment...`);

    // Check if site is accessible
    const httpCode = await checkSiteAccessible();

    if (httpCode !== 200) {
      logger.warn(
        `Website not accessible yet (HTTP ${httpCode}), retrying in ${RETRY_DELAY / 1000}s...`
      );
      await sleep(RETRY_DELAY);
      continue;
    }

    // Check if correct commit is deployed
    const isDeployed = await checkCommitDeployed();

    if (isDeployed) {
      logger.success(`Correct commit ${EXPECTED_COMMIT} is deployed!`);
      logger.info("");
      logger.success("Verification completed successfully");
      return;
    }

    logger.warn(
      `Commit ${EXPECTED_COMMIT} not found yet, retrying in ${RETRY_DELAY / 1000}s...`
    );
    await sleep(RETRY_DELAY);
  }

  logger.error(`Timeout: Commit ${EXPECTED_COMMIT} was not deployed after ${MAX_ATTEMPTS} attempts`);
  process.exit(1);
}

main().catch((error) => {
  console.error("❌ Verify deployment workflow failed:", error);
  process.exit(1);
});
