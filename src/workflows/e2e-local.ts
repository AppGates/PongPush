#!/usr/bin/env bun

import { execSync } from "child_process";
import { writeFileSync, mkdirSync, existsSync, cpSync } from "fs";

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

function log(message: string): void {
  console.log(message);
}

function runCommand(command: string, description: string): void {
  log(`📝 === ${description} ===`);
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    log(`❌ ${description} failed`);
    throw error;
  }
}

function pushLogsToGit(): void {
  log("📝");
  log("📝 === Pushing Test Logs to Branch ===");

  // Create logs directory
  mkdirSync("ci-logs", { recursive: true });

  // Copy test results if they exist
  if (existsSync("test-results")) {
    log("📝 Copying test-results to ci-logs/");
    cpSync("test-results", "ci-logs/test-results", { recursive: true });
  }

  // Copy playwright report if it exists
  if (existsSync("playwright-report")) {
    log("📝 Copying playwright-report to ci-logs/");
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
  log("📝 Created summary.txt");

  // Configure git
  try {
    execSync('git config user.name "github-actions[bot]"', { stdio: "inherit" });
    execSync('git config user.email "github-actions[bot]@users.noreply.github.com"', { stdio: "inherit" });

    // Add and commit logs
    execSync("git add -f ci-logs/", { stdio: "inherit" });

    try {
      execSync(`git commit -m "CI: Add E2E test logs for ${COMMIT_SHA}"`, { stdio: "inherit" });
    } catch (error) {
      log("📝 No changes to commit");
    }

    // Push to the current branch
    try {
      execSync(`git push origin HEAD:${GITHUB_REF}`, { stdio: "inherit" });
      log("📝 ✅ Logs pushed successfully");
    } catch (error) {
      log("📝 ⚠️ Failed to push logs");
    }
  } catch (error) {
    log("📝 ⚠️ Git operations failed");
  }
}

async function main() {
  log("📝");
  log("📝 ================================");
  log("📝 === E2E Local Test Workflow ===");
  log("📝 ================================");
  log("📝");
  log(`📝 Timestamp: ${new Date().toISOString()}`);
  log(`📝 Commit: ${COMMIT_SHA}`);
  log("📝");

  let testFailed = false;

  try {
    // Install dependencies
    runCommand("npm ci", "Installing dependencies");
    log("📝");

    // Install Playwright browsers
    runCommand("npx playwright install --with-deps chromium", "Installing Playwright browsers");
    log("📝");

    // Build application
    runCommand("npm run build", "Building application");
    log("📝");

    // Run E2E tests
    try {
      runCommand("npm run test", "Running E2E tests");
      log("📝 ✅ E2E tests passed");
    } catch (error) {
      log("📝 ❌ E2E tests failed");
      testFailed = true;
    }
  } finally {
    // Always push logs, even if tests fail
    pushLogsToGit();
  }

  if (testFailed) {
    log("📝");
    log("📝 ❌ Workflow completed with test failures");
    process.exit(1);
  }

  log("📝");
  log("📝 ✅ Workflow completed successfully");
}

main().catch((error) => {
  console.error("❌ E2E local workflow failed:", error);
  process.exit(1);
});
