#!/usr/bin/env bun

import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { log } from "./utils/logger";

/**
 * Build workflow
 * - Installs dependencies
 * - Runs type checking
 * - Builds the application with GitHub token injection
 */

const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN || "";

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
  log("📝 ==========================");
  log("📝 === Build Workflow Started ===");
  log("📝 ==========================");
  log("📝");
  log(`📝 Timestamp: ${new Date().toISOString()}`);
  log("📝");

  // Install dependencies
  runCommand("npm ci", "Installing dependencies");
  log("📝");

  // Type check
  runCommand("npm run type-check", "Running type check");
  log("📝");

  // Inject GitHub token into build
  log("📝 === Injecting GitHub token ===");
  mkdirSync("public", { recursive: true });
  writeFileSync(
    "public/config.js",
    `window.__GITHUB_TOKEN__ = '${GITHUB_TOKEN}';`
  );
  log("📝");

  // Build application
  runCommand("npm run build", "Building application");
  log("📝");

  log("📝 ✅ Build completed successfully");
}

main().catch((error) => {
  console.error("❌ Build workflow failed:", error);
  process.exit(1);
});
