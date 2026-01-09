# Claude Development Guidelines for PongPush

This document contains mandatory steps and best practices that Claude must follow when working on this repository.

## Mandatory Steps

### 1. Always Check Pipeline Status After Commits

**CRITICAL:** After pushing any commit, you MUST verify the pipeline status and check the results.

**Required Method:**
Always use the `check-pipeline.ts` script to verify pipeline status:

```bash
# After git push, run the pipeline checker
bun src/workflows/check-pipeline.ts
```

The script will automatically:
- Wait for all workflow runs to complete (or use `--no-wait` to check immediately)
- Pull the latest logs from the branch
- Display workflow run summaries with status and conclusion
- Find and analyze all log files for the current commit
- Report any errors found in logs
- Exit with code 0 on success, 1 on failure

**Steps to follow:**
1. After `git push`, immediately run: `bun src/workflows/check-pipeline.ts`
2. Review the workflow summary and log analysis
3. If there are errors, fix them immediately before proceeding
4. Never assume the workflow succeeded - always verify!

**DO NOT** manually check logs with bash commands - always use the TypeScript script.

### 2. Use TypeScript Workflows

All workflow logic should be written in TypeScript and placed in `src/workflows/`.

**Pattern:**
```typescript
#!/usr/bin/env bun

import { log } from "./utils/logger";

async function main() {
  log("📝");
  log("📝 === Workflow Name ===");
  log("📝");

  // Your logic here

  log("📝 ✅ Workflow completed successfully");
}

main().catch((error) => {
  console.error("❌ Workflow failed:", error);
  process.exit(1);
});
```

**Execute via:**
```yaml
- name: Run workflow
  run: ./run-workflow.sh your-workflow.ts
```

### 3. Centralized Logging

All TypeScript workflows are executed through `./run-workflow.sh` which:
- Creates log directories by commit SHA in `ci-logs/<commit-sha>/`
- Redirects stdout to `ci-logs/<commit-sha>/stdout.log`
- Redirects stderr to `ci-logs/<commit-sha>/stderr.log`
- Shows output in GitHub Actions console via `tee`

**Never bypass this script** - always use `./run-workflow.sh <workflow-file>.ts`

### 4. Workflow Files Must Be Executable

Always make TypeScript workflow files executable:
```bash
chmod +x src/workflows/your-workflow.ts
```

### 5. Git Operations Best Practices

**Branch naming:**
- All Claude branches must start with `claude/`
- Must end with matching session ID for push authentication

**Pushing:**
- Always use: `git push -u origin <branch-name>`
- If push fails due to new commits, use: `git pull origin <branch-name> --rebase`
- Retry network failures up to 4 times with exponential backoff

**Committing:**
- Use clear, descriptive commit messages
- Follow the repository's commit style (check `git log`)
- Never commit secrets or credentials

### 6. Error Handling

- Workflows should fail fast and loudly
- Never use `|| true` to hide errors in critical commands
- Use `|| true` only for non-critical operations (like cleanup)
- Always check exit codes and propagate failures

### 7. Testing and Validation

Before pushing changes:
1. Verify syntax is correct
2. Check that all referenced files exist
3. Ensure environment variables are properly passed
4. Test locally if possible

After pushing changes:
1. **Check pipeline status** (see step 1)
2. Review logs for warnings or errors
3. Verify the expected behavior occurred

## Repository Structure

```
.
├── .github/
│   └── workflows/          # GitHub Actions workflow YAML files
├── src/
│   └── workflows/          # TypeScript workflow implementations
│       ├── auto-pr.ts
│       ├── build.ts
│       ├── check-pipeline.ts
│       ├── cleanup-branches.ts
│       ├── e2e-local.ts
│       ├── e2e-deployed.ts
│       ├── verify-deployment.ts
│       └── utils/
│           └── logger.ts
├── ci-logs/                # Generated logs (by commit SHA)
│   └── <commit-sha>/
│       ├── stdout.log
│       ├── stderr.log
│       └── auto-pr.log
└── run-workflow.sh         # Centralized workflow executor

```

## Common Workflows

### Check Pipeline Workflow
- **File:** `src/workflows/check-pipeline.ts`
- **Usage:** `bun src/workflows/check-pipeline.ts [--no-wait]`
- **Purpose:** Verify pipeline status after pushing commits
- Waits for all workflow runs to complete (unless `--no-wait`)
- Pulls logs from the branch automatically
- Displays workflow summaries with status and conclusion
- Analyzes log files for errors
- Returns exit code 0 on success, 1 on failure
- **When to use:** After EVERY `git push`

### Auto PR Workflow
- Triggers on: Push to `claude/**` branches
- Creates PRs automatically
- Cleans up old logs
- Cleans up stale branches

### Build Workflow
- Runs type checking
- Builds the application
- Injects GitHub token

### E2E Testing
- `e2e-local.ts`: Tests against local build (feature branches)
- `e2e-deployed.ts`: Tests against deployed site (main branch)

### Cleanup Workflow
- Runs daily at 2 AM UTC
- Removes stale `claude/**` branches with no unique commits

## Quick Reference

### Check pipeline status
```bash
# Check pipeline status and wait for completion
bun src/workflows/check-pipeline.ts

# Quick check without waiting
bun src/workflows/check-pipeline.ts --no-wait

# After pushing changes
git push -u origin <branch> && bun src/workflows/check-pipeline.ts
```

### Create new TypeScript workflow
```bash
# 1. Create file
cat > src/workflows/my-workflow.ts << 'EOF'
#!/usr/bin/env bun
import { log } from "./utils/logger";

async function main() {
  log("📝 My workflow");
  // Your code here
}

main().catch((error) => {
  console.error("❌ Failed:", error);
  process.exit(1);
});
EOF

# 2. Make executable
chmod +x src/workflows/my-workflow.ts

# 3. Use in workflow YAML
# run: ./run-workflow.sh my-workflow.ts
```

## Remember

🔴 **ALWAYS check pipeline status after pushing** - this is non-negotiable!
🔴 **Use `bun src/workflows/check-pipeline.ts` to verify pipeline status** - never skip this!

✅ Use TypeScript for all workflow logic
✅ Use `./run-workflow.sh` for execution in CI
✅ Use `bun src/workflows/check-pipeline.ts` after every push
✅ Check logs automatically with check-pipeline.ts
✅ Make files executable with `chmod +x`
✅ Follow git best practices
✅ Fail fast, fix immediately
