#!/usr/bin/env bun

import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { Logger } from "./utils/logger";

/**
 * Build workflow
 * - Installs dependencies
 * - Runs type checking
 * - Builds the application with GitHub token injection
 */

const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN || "";
const logger = new Logger({
  logFile: process.env.WORKFLOW_LOG_FILE,
  prefix: "Build"
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
  logger.section("Build Workflow Started");
  logger.info(`Timestamp: ${new Date().toISOString()}`);
  logger.info("");

  // Install dependencies
  runCommand("npm ci", "Installing dependencies");
  logger.info("");

  // Type check
  runCommand("npm run type-check", "Running type check");
  logger.info("");

  // Inject GitHub token into build
  logger.info("=== Injecting GitHub token ===");
  mkdirSync("public", { recursive: true });
  writeFileSync(
    "public/config.js",
    `window.__GITHUB_TOKEN__ = '${GITHUB_TOKEN}';`
  );
  logger.info("");

  // Build application
  runCommand("npm run build", "Building application");
  logger.info("");

  logger.success("Build completed successfully");
}

main().catch((error) => {
  console.error("❌ Build workflow failed:", error);
  process.exit(1);
});
