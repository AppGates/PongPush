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

function pushLogsToGit(): void {
  logger.info("");
  logger.info("=== Pushing Test Logs to Branch ===");

  // Create logs directory
  mkdirSync("ci-logs", { recursive: true });

  // Copy test results if they exist
  if (existsSync("test-results")) {
    logger.info("Copying test-results to ci-logs/");
    cpSync("test-results", "ci-logs/test-results", { recursive: true });
  }

  // Copy playwright report if it exists
  if (existsSync("playwright-report")) {
    logger.info("Copying playwright-report to ci-logs/");
    cpSync("playwright-report", "ci-logs/playwright-report", { recursive: true });
  }

  // Create summary file
  const summary = `=== E2E Test Run ===
Date: ${new Date().toISOString()}
Commit: ${COMMIT_SHA}
Ref: ${GITHUB_REF}
Job: e2e-local
`;
  writeFileSync("ci-logs/summary.txt", summary);
  logger.info("Created summary.txt");

  // Configure git
  try {
    execSync('git config user.name "github-actions[bot]"', { stdio: "inherit" });
    execSync('git config user.email "github-actions[bot]@users.noreply.github.com"', { stdio: "inherit" });

    // Add and commit logs
    execSync("git add -f ci-logs/", { stdio: "inherit" });

    try {
      execSync(`git commit -m "CI: Add E2E test logs for ${COMMIT_SHA}"`, { stdio: "inherit" });
    } catch (error) {
      logger.info("No changes to commit");
    }

    // Push to the current branch
    try {
      execSync(`git push origin HEAD:${GITHUB_REF}`, { stdio: "inherit" });
      logger.success("Logs pushed successfully");
    } catch (error) {
      logger.warn("Failed to push logs");
    }
  } catch (error) {
    logger.warn("Git operations failed");
  }
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
    // Always push logs, even if tests fail
    pushLogsToGit();
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
