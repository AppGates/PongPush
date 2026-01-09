#!/bin/bash
set -e

# Usage: run-workflow.sh <workflow-name>
# Example: run-workflow.sh auto-pr.ts
if [ -z "$1" ]; then
  echo "Error: No workflow file specified"
  echo "Usage: $0 <workflow-name>"
  exit 1
fi

WORKFLOW_FILE="src/workflows/$1"
SHORT_SHA=$(git rev-parse --short=7 HEAD)
LOG_DIR="ci-logs/${SHORT_SHA}"

mkdir -p "${LOG_DIR}"

bun run "$WORKFLOW_FILE" > >(tee "${LOG_DIR}/stdout.log") 2> >(tee "${LOG_DIR}/stderr.log" >&2)
