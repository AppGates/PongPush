#!/bin/bash
# Example GitHub API Script
# This script demonstrates how to make GitHub API calls
# The GITHUB_TOKEN environment variable is automatically available

set -e

echo "📊 Example: Fetching repository information"
echo ""

# Get repository info
REPO_INFO=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/AppGates/PongPush)

echo "Repository: $(echo "$REPO_INFO" | jq -r '.full_name')"
echo "Description: $(echo "$REPO_INFO" | jq -r '.description // "N/A"')"
echo "Stars: $(echo "$REPO_INFO" | jq -r '.stargazers_count')"
echo "Forks: $(echo "$REPO_INFO" | jq -r '.forks_count')"
echo "Open Issues: $(echo "$REPO_INFO" | jq -r '.open_issues_count')"
echo ""

echo "📋 Recent Pull Requests:"
PRS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/AppGates/PongPush/pulls?state=all&per_page=5")

echo "$PRS" | jq -r '.[] | "- #\(.number): \(.title) (\(.state))"'
echo ""

echo "✅ GitHub API call completed successfully"
