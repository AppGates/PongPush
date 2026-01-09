#!/bin/bash
set -e

# Usage: run-workflow.sh <typescript-workflow-file>
if [ -z "$1" ]; then
  echo "Error: No workflow file specified"
  echo "Usage: $0 <typescript-workflow-file>"
  exit 1
fi

WORKFLOW_FILE="$1"
SHORT_SHA=$(git rev-parse --short=7 HEAD)
LOG_DIR="ci-logs/${SHORT_SHA}"

mkdir -p "${LOG_DIR}"

bun run "$WORKFLOW_FILE" > >(tee "${LOG_DIR}/stdout.log") 2> >(tee "${LOG_DIR}/stderr.log" >&2)
