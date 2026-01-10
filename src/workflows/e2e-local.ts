#!/usr/bin/env bun

import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync, cpSync } from "fs";
import { Logger } from "./utils/logger";

/**
 * E2E Local Testing workflow
 * - Installs dependencies
 * - Installs Playwright browsers
 * - Builds the application
 * - Runs E2E tests against local preview
 * - Pushes test logs to branch
 */

const COMMIT_SHA = process.env.GITHUB_SHA || "";
const GITHUB_REF = process.env.GITHUB_REF || "";

const logger = new Logger({
  logFile: process.env.WORKFLOW_LOG_FILE,
  prefix: "E2E-Local"
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

function copyTestArtifacts(): void {
  logger.info("");
  logger.info("=== Copying Test Artifacts ===");

  // Get the commit SHA for the log directory
  const shortSha = COMMIT_SHA.substring(0, 7);
  const logDir = `ci-logs/${shortSha}`;
  mkdirSync(logDir, { recursive: true });

  // Copy test results if they exist
  if (existsSync("test-results")) {
    logger.info("Copying test-results to ci-logs/");
    cpSync("test-results", `${logDir}/test-results`, { recursive: true });
  }

  // Copy playwright report if it exists
  if (existsSync("playwright-report")) {
    logger.info("Copying playwright-report to ci-logs/");
    cpSync("playwright-report", `${logDir}/playwright-report`, { recursive: true });
  }

  // Create summary file
  const summary = `=== E2E Test Run ===
Date: ${new Date().toISOString()}
Commit: ${COMMIT_SHA}
Ref: ${GITHUB_REF}
Job: e2e-local
`;
  writeFileSync(`${logDir}/e2e-summary.txt`, summary);
  logger.info("Created e2e-summary.txt");
}

async function main() {
  logger.info("");
  logger.section("E2E Local Test Workflow");
  logger.info(`Timestamp: ${new Date().toISOString()}`);
  logger.info(`Commit: ${COMMIT_SHA}`);
  logger.info("");

  let testFailed = false;

  try {
    // Install dependencies
    runCommand("npm ci", "Installing dependencies");
    logger.info("");

    // Install Playwright browsers
    runCommand("npx playwright install --with-deps chromium", "Installing Playwright browsers");
    logger.info("");

    // Build application
    runCommand("npm run build", "Building application");
    logger.info("");

    // Run E2E tests
    try {
      runCommand("npm run test", "Running E2E tests");
      logger.success("E2E tests passed");
    } catch (error) {
      logger.error("E2E tests failed");
      testFailed = true;
    }
  } finally {
    // Always copy test artifacts, even if tests fail
    // The GitHub Actions workflow will push them via push-logs.sh
    copyTestArtifacts();
  }

  if (testFailed) {
    logger.info("");
    logger.error("Workflow completed with test failures");
    process.exit(1);
  }

  logger.info("");
  logger.success("Workflow completed successfully");
}

main().catch((error) => {
  console.error("❌ E2E local workflow failed:", error);
  process.exit(1);
});
