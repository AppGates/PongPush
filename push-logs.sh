#!/bin/bash
set -e

# Usage: push-logs.sh <log-description>
# Example: push-logs.sh "auto-PR logs"

LOG_DESCRIPTION="${1:-logs}"
COMMIT_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"
CURRENT_BRANCH="${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD)}"

echo "📝 Pushing logs to branch: ${CURRENT_BRANCH}"
echo "📝 Commit: ${COMMIT_SHA}"
echo "📝 Description: ${LOG_DESCRIPTION}"

# Configure git
git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"

# Pull latest changes to avoid conflicts
git pull --rebase origin "${CURRENT_BRANCH}" || true

# Add logs
git add -f ci-logs/

# Commit logs (|| true means don't fail if nothing to commit)
git commit -m "CI: Add ${LOG_DESCRIPTION} for ${COMMIT_SHA}" || true

# Push to branch (|| true means don't fail if push fails)
git push origin HEAD:refs/heads/${CURRENT_BRANCH} || true

echo "✅ Logs push completed"
