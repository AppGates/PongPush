#!/usr/bin/env bun

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

function log(message: string): void {
  console.log(message);
}

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
  log("📝");
  log("📝 ====================================");
  log("📝 === Verify Deployment Workflow ===");
  log("📝 ====================================");
  log("📝");
  log(`📝 Timestamp: ${new Date().toISOString()}`);
  log(`📝 Expected commit: ${EXPECTED_COMMIT}`);
  log(`📝 Site URL: ${SITE_URL}`);
  log("📝");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    log(`📝 Attempt ${attempt}/${MAX_ATTEMPTS}: Checking deployment...`);

    // Check if site is accessible
    const httpCode = await checkSiteAccessible();

    if (httpCode !== 200) {
      log(
        `⏳ Website not accessible yet (HTTP ${httpCode}), retrying in ${RETRY_DELAY / 1000}s...`
      );
      await sleep(RETRY_DELAY);
      continue;
    }

    // Check if correct commit is deployed
    const isDeployed = await checkCommitDeployed();

    if (isDeployed) {
      log(`✅ Correct commit ${EXPECTED_COMMIT} is deployed!`);
      log("📝");
      log("📝 ✅ Verification completed successfully");
      return;
    }

    log(
      `⏳ Commit ${EXPECTED_COMMIT} not found yet, retrying in ${RETRY_DELAY / 1000}s...`
    );
    await sleep(RETRY_DELAY);
  }

  log(`❌ Timeout: Commit ${EXPECTED_COMMIT} was not deployed after ${MAX_ATTEMPTS} attempts`);
  process.exit(1);
}

main().catch((error) => {
  console.error("❌ Verify deployment workflow failed:", error);
  process.exit(1);
});
