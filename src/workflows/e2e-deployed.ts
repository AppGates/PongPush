#!/usr/bin/env bun

import { execSync } from "child_process";

/**
 * E2E Deployed Testing workflow
 * - Installs dependencies
 * - Installs Playwright browsers
 * - Runs E2E tests against deployed GitHub Pages site
 */

const COMMIT_SHA = process.env.GITHUB_SHA || "";
const EXPECTED_COMMIT_SHA = process.env.EXPECTED_COMMIT_SHA || COMMIT_SHA;
const DEPLOYED_SITE_URL = process.env.DEPLOYED_SITE_URL || "https://appgates.github.io/PongPush/";

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

async function main() {
  log("📝");
  log("📝 ====================================");
  log("📝 === E2E Deployed Test Workflow ===");
  log("📝 ====================================");
  log("📝");
  log(`📝 Timestamp: ${new Date().toISOString()}`);
  log(`📝 Expected commit: ${EXPECTED_COMMIT_SHA}`);
  log(`📝 Deployed site: ${DEPLOYED_SITE_URL}`);
  log("📝");

  // Install dependencies
  runCommand("npm ci", "Installing dependencies");
  log("📝");

  // Install Playwright browsers
  runCommand("npx playwright install --with-deps chromium", "Installing Playwright browsers");
  log("📝");

  // Run E2E tests against deployed site
  try {
    runCommand("npm run test", "Running E2E tests against deployed site");
    log("📝");
    log("📝 ✅ E2E tests passed");
  } catch (error) {
    log("📝");
    log("📝 ❌ E2E tests failed");
    throw error;
  }

  log("📝");
  log("📝 ✅ Workflow completed successfully");
}

main().catch((error) => {
  console.error("❌ E2E deployed workflow failed:", error);
  process.exit(1);
});
