# Claude Development Guidelines for PongPush

This document contains mandatory steps and best practices that Claude must follow when working on this repository.

## Mandatory Steps

### 1. Always Check Pipeline Status After Commits

**CRITICAL:** After pushing any commit, you MUST verify the pipeline status and check the results.

**Steps to follow:**
1. After `git push`, wait a moment for the workflow to start
2. Check the workflow status with:
   ```bash
   git pull origin <branch-name>
   ls -la ci-logs/
   ```
3. Read the latest logs to verify success:
   ```bash
   # Find the latest log directory (by commit SHA)
   ls -la ci-logs/

   # Check stdout and stderr
   cat ci-logs/<commit-sha>/stdout.log
   cat ci-logs/<commit-sha>/stderr.log
   ```
4. If there are errors, fix them immediately before proceeding
5. Never assume the workflow succeeded - always verify!

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

### Check latest pipeline logs
```bash
git pull origin <branch>
LATEST=$(ls -t ci-logs/ | head -1)
cat ci-logs/$LATEST/stdout.log
cat ci-logs/$LATEST/stderr.log
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

✅ Use TypeScript for all workflow logic
✅ Use `./run-workflow.sh` for execution
✅ Check logs in `ci-logs/<commit-sha>/`
✅ Make files executable with `chmod +x`
✅ Follow git best practices
✅ Fail fast, fix immediately
