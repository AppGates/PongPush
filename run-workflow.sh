#!/bin/bash
set -e
set -o pipefail

# Usage: run-workflow.sh <workflow-name>
# Example: run-workflow.sh auto-pr.ts
if [ -z "$1" ]; then
  echo "Error: No workflow file specified"
  echo "Usage: $0 <workflow-name>"
  exit 1
fi

WORKFLOW_FILE="src/workflows/$1"
WORKFLOW_NAME=$(basename "$1" .ts)
SHORT_SHA=$(git rev-parse --short=7 HEAD)
LOG_DIR="ci-logs/${SHORT_SHA}"

mkdir -p "${LOG_DIR}"

# Set log file path for the workflow to use with Logger
export WORKFLOW_LOG_FILE="${LOG_DIR}/workflow.log"

# Run workflow and capture exit code
# Using explicit variable to ensure error propagation with process substitution
set +e
bun run "$WORKFLOW_FILE" > >(tee "${LOG_DIR}/stdout.log") 2> >(tee "${LOG_DIR}/stderr.log" >&2)
EXIT_CODE=$?

# Wait for background processes (tee) to complete, but don't let wait override our exit code
wait
set -e

# Write status semaphore file
if [ $EXIT_CODE -eq 0 ]; then
  echo "success" > "${LOG_DIR}/${WORKFLOW_NAME}.status"
else
  echo "failed" > "${LOG_DIR}/${WORKFLOW_NAME}.status"
fi

# Exit with the workflow's exit code
exit $EXIT_CODE
