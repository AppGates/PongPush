#!/usr/bin/env bun

import { execSync } from "child_process";
import { Logger } from "./utils/logger";

/**
 * E2E Deployed Testing workflow
 * - Installs dependencies
 * - Installs Playwright browsers
 * - Runs E2E tests against deployed GitHub Pages site
 */

const COMMIT_SHA = process.env.GITHUB_SHA || "";
const EXPECTED_COMMIT_SHA = process.env.EXPECTED_COMMIT_SHA || COMMIT_SHA;
const DEPLOYED_SITE_URL = process.env.DEPLOYED_SITE_URL || "https://appgates.github.io/PongPush/";

const logger = new Logger({
  logFile: process.env.WORKFLOW_LOG_FILE,
  prefix: "E2E-Deployed"
});

function runCommand(command: string, description: string): void {
  logger.info(`=== ${description} ===`);
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    logger.error(`${description} failed`);
    throw error;
  }
}

async function main() {
  logger.info("");
  logger.section("E2E Deployed Test Workflow");
  logger.info(`Timestamp: ${new Date().toISOString()}`);
  logger.info(`Expected commit: ${EXPECTED_COMMIT_SHA}`);
  logger.info(`Deployed site: ${DEPLOYED_SITE_URL}`);
  logger.info("");

  // Install dependencies
  runCommand("npm ci", "Installing dependencies");
  logger.info("");

  // Install Playwright browsers
  runCommand("npx playwright install --with-deps chromium", "Installing Playwright browsers");
  logger.info("");

  // Run E2E tests against deployed site
  try {
    runCommand("npm run test", "Running E2E tests against deployed site");
    logger.info("");
    logger.success("E2E tests passed");
  } catch (error) {
    logger.info("");
    logger.error("E2E tests failed");
    throw error;
  }

  logger.info("");
  logger.success("Workflow completed successfully");
}

main().catch((error) => {
  console.error("❌ E2E deployed workflow failed:", error);
  process.exit(1);
});
