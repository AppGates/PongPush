# Workflow TypeScript Development Guide

This document outlines the architecture, patterns, and best practices for developing GitHub Actions workflows in TypeScript with Bun.

## Architecture Overview

```
.github/workflows-ts/
├── utils/                  # Reusable utilities (shared across all workflows)
│   ├── logger.ts          # Structured logging with file output
│   ├── process.ts         # Process spawning utilities
│   ├── github.ts          # GitHub API wrapper
│   ├── git.ts             # Git operations wrapper
│   └── log-pusher.ts      # Log pushing to branch
├── auto-pr.ts             # Auto-PR workflow logic
├── package.json           # Dependencies
└── tsconfig.json          # TypeScript configuration
```

## Core Principles

### 1. Reusability Over Duplication

**ALWAYS** create reusable functions for repeated operations.

**Bad:**
```typescript
// Duplicated process spawning in multiple places
const proc1 = Bun.spawn(['gh', 'pr', 'list'], { stdout: 'pipe', stderr: 'pipe' });
const stdout1 = await new Response(proc1.stdout).text();
const stderr1 = await new Response(proc1.stderr).text();

const proc2 = Bun.spawn(['gh', 'pr', 'view'], { stdout: 'pipe', stderr: 'pipe' });
const stdout2 = await new Response(proc2.stdout).text();
const stderr2 = await new Response(proc2.stderr).text();
```

**Good:**
```typescript
// Single reusable function in utils/process.ts
const result1 = await spawnGhCommand(['pr', 'list'], token, logger);
const result2 = await spawnGhCommand(['pr', 'view', '123'], token, logger);
```

### 2. DRY (Don't Repeat Yourself)

If you're doing the same thing in 3+ places, extract it into a utility function.

**Examples of what to extract:**
- Process spawning patterns → `utils/process.ts`
- GitHub API calls → `utils/github.ts`
- Git operations → `utils/git.ts`
- Logging patterns → `utils/logger.ts`
- File operations → Create new utility modules as needed

### 3. Keep It Short

**Target complexity levels:**
- Individual functions: 10-30 lines
- Workflow scripts: 100-200 lines
- Utility modules: 200-400 lines

**If a file gets too large:**
- Split by responsibility (e.g., `github-pr.ts`, `github-issues.ts`)
- Extract common patterns into smaller utilities
- Create focused, single-purpose modules

## Reusable Utilities

### Process Spawning (`utils/process.ts`)

**Purpose:** Consistent process execution with logging and error handling

**Key functions:**
```typescript
spawnProcess(command: string[], logger: Logger, options?: SpawnOptions)
spawnGhCommand(args: string[], token: string, logger: Logger, options?: SpawnOptions)
spawnGitCommand(args: string[], logger: Logger, options?: SpawnOptions)
```

**When to use:**
- ANY external process execution
- Ensures consistent stdout/stderr capture
- Centralized error handling
- Automatic logging of commands

**Benefits:**
- Easy to add retry logic in one place
- Easy to add timeout handling
- Easy to enhance with additional features
- Consistent error messages

### Logging (`utils/logger.ts`)

**Purpose:** Structured, searchable logs with multiple output formats

**Key features:**
- Console output with emoji icons
- File output with timestamps
- Log levels: info, warn, error, success, debug
- Hierarchical logging with child loggers
- Section headers for visual organization

**Usage:**
```typescript
const logger = new Logger({ logFile: 'workflow.log', prefix: 'WorkflowName' });
logger.section('Starting Process');
logger.info('Processing item...');
logger.success('Completed successfully');
```

### GitHub Operations (`utils/github.ts`)

**Purpose:** High-level GitHub API operations

**Pattern:**
```typescript
export class GitHubClient {
  constructor(token: string, repository: string, logger: Logger)

  async findPullRequest(branch: string): Promise<number | null>
  async createPullRequest(...): Promise<{ number, url } | null>
  // etc.
}
```

**When to add methods:**
- Any GitHub operation used 2+ times
- Complex API interactions
- Operations requiring authentication

### Git Operations (`utils/git.ts`)

**Purpose:** Git command wrappers with error handling

**Pattern:**
```typescript
export class GitClient {
  constructor(logger: Logger)

  async commit(message: string): Promise<boolean>
  async push(remote: string, ref: string): Promise<boolean>
  // etc.
}
```

**Features to include:**
- Retry logic for network operations (push, fetch)
- Clear error messages
- Graceful handling of "nothing to commit" scenarios

## Workflow Design Pattern

### Structure

Every workflow script should follow this pattern:

```typescript
#!/usr/bin/env bun

import { Logger } from './utils/logger';
import { GitHubClient } from './utils/github';
import { GitClient } from './utils/git';

interface WorkflowContext {
  // Environment variables parsed into typed structure
}

async function getWorkflowContext(): Promise<WorkflowContext> {
  // Parse environment variables
  // Validate required values
  // Return typed context
}

async function main() {
  const logger = new Logger({ logFile: 'workflow-name.log', prefix: 'WorkflowName' });

  logger.section('Workflow Started');

  try {
    const ctx = await getWorkflowContext();

    // Initialize clients
    const github = new GitHubClient(ctx.token, ctx.repository, logger);
    const git = new GitClient(logger);

    // Workflow logic in clear sections
    logger.section('Step 1');
    // ...

    logger.section('Step 2');
    // ...

    logger.section('Workflow Complete');
  } catch (error) {
    logger.error(`Workflow failed: ${error}`);
    logger.section('Workflow Complete (with errors)');
    process.exit(1);
  }
}

main();
```

### Workflow YAML Pattern

```yaml
jobs:
  job-name:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Run workflow script
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          # Capture all output for debugging
          if bun run .github/workflows-ts/workflow-name.ts 2>&1 | tee -a workflow.log; then
            echo "=== Workflow Complete (Success) ===" | tee -a workflow.log
          else
            echo "=== Workflow Failed ===" | tee -a workflow.log
            exit 0  # Don't fail so logs can be pushed
          fi

      - name: Upload logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: workflow-logs
          path: workflow.log
          retention-days: 7

      - name: Push logs to branch
        if: always()
        run: |
          mkdir -p ci-logs
          cp workflow.log ci-logs/workflow-name-output.log || true

          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -f ci-logs/
          git commit -m "CI: Add workflow logs for ${{ github.sha }}" || echo "No changes"
          git push origin HEAD:${{ github.ref }} || echo "Failed to push logs"
```

## Testing Workflows

### Before Committing

1. **Local validation:**
   ```bash
   bun run .github/workflows-ts/workflow-name.ts
   ```

2. **Type checking:**
   ```bash
   cd .github/workflows-ts && tsc --noEmit
   ```

### After Pushing

1. **Check logs are pushed to branch:**
   ```bash
   git pull origin your-branch
   ls -la ci-logs/
   cat ci-logs/workflow-name-output.log
   ```

2. **Verify log structure:**
   - Clear section headers
   - Command execution logs visible
   - Error messages captured
   - Timestamps present

3. **Test error scenarios:**
   - Introduce intentional errors
   - Verify logs still get pushed
   - Check error messages are helpful

## Common Patterns

### Retry Logic

```typescript
async push(remote: string, ref: string, maxRetries = 4): Promise<boolean> {
  const delays = [2000, 4000, 8000, 16000]; // Exponential backoff

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await spawnGitCommand(['push', '-u', remote, ref], this.logger);

      if (!result.success) {
        if (isNetworkError(result.stderr) && attempt < maxRetries) {
          await Bun.sleep(delays[attempt]);
          continue;
        }
        throw new Error(`Push failed: ${result.stderr}`);
      }

      return true;
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }
  }
  return false;
}
```

### Error Handling

```typescript
// Return null on failure (for optional operations)
async findPullRequest(branch: string): Promise<number | null> {
  try {
    const result = await spawnGhCommand([...], token, logger);
    if (!result.success) {
      logger.error(`Command failed: ${result.stderr}`);
      return null;
    }
    return parseResult(result.stdout);
  } catch (error) {
    logger.error(`Unexpected error: ${error}`);
    return null;
  }
}

// Throw on failure (for required operations)
async getLatestCommit(): Promise<string> {
  const result = await spawnGitCommand(['rev-parse', 'HEAD'], logger);
  if (!result.success) {
    throw new Error(`Failed to get commit: ${result.stderr}`);
  }
  return result.stdout;
}
```

### Logging Sections

```typescript
// Use sections to organize workflow output
logger.section('Phase 1: Preparation');
logger.info('Loading configuration...');
logger.success('Configuration loaded');

logger.section('Phase 2: Execution');
logger.info('Running operation...');
logger.warn('Non-critical issue detected');

logger.section('Phase 3: Cleanup');
logger.info('Cleaning up resources...');
```

## Adding New Workflows

1. **Create script:** `.github/workflows-ts/new-workflow.ts`
2. **Use utilities:** Import from `utils/`
3. **Follow pattern:** Use standard structure above
4. **Add YAML:** `.github/workflows/new-workflow.yml`
5. **Test thoroughly:** Check logs are captured
6. **Document:** Add notes if workflow has special requirements

## Migration Checklist

When migrating a bash workflow to TypeScript:

- [ ] Create TypeScript script following standard pattern
- [ ] Extract reusable logic to utilities
- [ ] Set up comprehensive logging
- [ ] Ensure all stdout/stderr is captured
- [ ] Add error handling for all operations
- [ ] Test with intentional failures
- [ ] Verify logs are pushed to branch
- [ ] Update YAML to use new script
- [ ] Commit and test in CI
- [ ] Verify logs are readable and helpful

## Key Takeaways

1. **Reuse, don't repeat** - Extract common patterns immediately
2. **Log everything** - Command execution, results, errors
3. **Keep it short** - Functions should be focused and concise
4. **Test with failures** - Ensure error paths work correctly
5. **Capture all output** - Always use `2>&1 | tee` in YAML
6. **Push logs always** - Use `if: always()` for log steps
