#!/bin/bash
set -e

# Usage: push-logs-to-pipeline-repo.sh <log-description>
# Pushes logs to the separate PongPush.Pipeline repository

LOG_DESCRIPTION="${1:-logs}"
COMMIT_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"
SHORT_SHA="${COMMIT_SHA:0:7}"
CURRENT_BRANCH="${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD)}"

echo "📝 Pushing logs to PongPush.Pipeline repository"
echo "📝 Source commit: ${COMMIT_SHA}"
echo "📝 Source branch: ${CURRENT_BRANCH}"
echo "📝 Description: ${LOG_DESCRIPTION}"

# Create temp directory for pipeline repo
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Clone pipeline repo (shallow clone for speed)
echo "📦 Cloning PongPush.Pipeline..."

# Use GITHUB_TOKEN for authentication if available
if [ -n "$GITHUB_TOKEN" ]; then
  git clone --depth 1 https://x-access-token:${GITHUB_TOKEN}@github.com/AppGates/PongPush.Pipeline.git .
else
  git clone --depth 1 https://github.com/AppGates/PongPush.Pipeline.git .
fi

# Configure git
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

# Copy logs from the workspace
echo "📋 Copying logs..."
if [ -d "$GITHUB_WORKSPACE/ci-logs" ]; then
  mkdir -p ci-logs
  cp -r "$GITHUB_WORKSPACE/ci-logs"/* ci-logs/ 2>/dev/null || true
else
  echo "⚠️  No ci-logs directory found in workspace"
fi

# Add metadata file
cat > ci-logs/${SHORT_SHA}/metadata.json << EOF
{
  "commit": "${COMMIT_SHA}",
  "branch": "${CURRENT_BRANCH}",
  "description": "${LOG_DESCRIPTION}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "workflow_run_id": "${GITHUB_RUN_ID:-unknown}",
  "workflow_run_url": "https://github.com/AppGates/PongPush/actions/runs/${GITHUB_RUN_ID:-unknown}"
}
EOF

# Add and commit
git add ci-logs/
git commit -m "CI: Add ${LOG_DESCRIPTION} for ${CURRENT_BRANCH}@${SHORT_SHA}" || {
  echo "ℹ️  No changes to commit"
  cd "$OLDPWD"
  rm -rf "$TEMP_DIR"
  exit 0
}

# Push to pipeline repo
echo "⬆️  Pushing to PongPush.Pipeline..."

# Set remote URL with token if available
if [ -n "$GITHUB_TOKEN" ]; then
  git remote set-url origin https://x-access-token:${GITHUB_TOKEN}@github.com/AppGates/PongPush.Pipeline.git
fi

git push origin main

cd "$OLDPWD"
rm -rf "$TEMP_DIR"

echo "✅ Logs pushed to PongPush.Pipeline repository"
echo "📁 View at: https://github.com/AppGates/PongPush.Pipeline/tree/main/ci-logs/${SHORT_SHA}"
