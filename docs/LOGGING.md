# Logging Framework

## Overview

PongPush uses a comprehensive logging framework that captures all output from application code, tests, and CI pipeline jobs. This ensures complete visibility into what happens during development and CI/CD execution.

## Architecture

### Application Logging (`src/utils/logger.ts`)

The application uses a structured logging framework:

```typescript
import { createLogger } from './utils/logger';

const logger = createLogger('ComponentName');

logger.info('Operation completed', { userId: 123 });
logger.error('Operation failed', { error: err.message });
```

**Features:**
- Structured JSON logging in CI environments
- Human-readable console output in development
- Automatic component/timestamp tagging
- Support for additional data payloads
- Timing utilities for performance tracking

### Test Logging

E2E tests use structured logging:

```typescript
log('INFO', 'Test started', { testName: 'upload form' });
log('WARN', 'Unexpected state', { state: currentState });
log('ERROR', 'Test failed', { error: error.message });
```

**Output:**
- JSON format in CI (`CI=true`)
- Human-readable format locally

### CI Pipeline Logging

All CI job output is captured using `tee`:

```bash
npm run build 2>&1 | tee -a build.log
```

**Captured logs:**
- `build.log` - Build job output
- `e2e-local.log` - E2E test job output
- All logs pushed to `ci-logs/job-output.log` in the branch

## CI Log Structure

When CI runs, logs are organized in `ci-logs/`:

```
ci-logs/
├── job-output.log           # Complete job console output
├── summary.txt              # Job summary and metadata
├── test-results/            # Playwright test results
└── playwright-report/       # HTML test report
```

## Log Formats

### Application Logs (Browser)

**Development:**
```
[2026-01-08T21:00:00.000Z] [INFO] [App] Starting PongPush application
[2026-01-08T21:00:01.000Z] [INFO] [App] Upload service initialized
```

**CI (JSON):**
```json
{"timestamp":"2026-01-08T21:00:00.000Z","level":"INFO","component":"App","message":"Starting PongPush application"}
{"timestamp":"2026-01-08T21:00:01.000Z","level":"INFO","component":"App","message":"Upload service initialized"}
```

### Test Logs

**Development:**
```
[INFO] Starting test: load app and show upload form
[INFO] Commit SHA verified {"commitSha":"abc123"}
[INFO] Test passed: app loaded successfully
```

**CI (JSON):**
```json
{"timestamp":"2026-01-08T21:00:00.000Z","level":"INFO","component":"E2E-Test","message":"Starting test: load app and show upload form"}
{"timestamp":"2026-01-08T21:00:01.000Z","level":"INFO","component":"E2E-Test","message":"Commit SHA verified","data":{"commitSha":"abc123"}}
```

### Pipeline Job Logs

Complete console output including:
- Dependency installation
- Build process
- Test execution
- All stdout and stderr

## Accessing Logs

### During Development

Logs appear in browser console or terminal:
```bash
npm run dev     # Application logs in browser console
npm run test    # Test logs in terminal
```

### In CI/CD

**Artifacts (7 days retention):**
- Available via Actions tab → Run → Artifacts
- `build-logs` - Build job logs
- `playwright-report` - Test results HTML

**Committed to Branch (feature branches only):**
- Automatically pushed to `ci-logs/` directory
- Pull branch to inspect: `git pull origin <branch>`
- View logs: `cat ci-logs/job-output.log`

## Log Levels

- **DEBUG**: Detailed diagnostic information
- **INFO**: General informational messages
- **WARN**: Warning messages (non-fatal issues)
- **ERROR**: Error messages (failures)

## Best Practices

### When to Log

**DO log:**
- Operation start/end
- State changes
- Configuration loaded
- API calls (without sensitive data)
- Errors and warnings
- Performance metrics

**DON'T log:**
- Sensitive data (passwords, tokens, PII)
- Excessive details in tight loops
- Redundant information

### Example Usage

```typescript
// Application code
const logger = createLogger('UploadService');

logger.info('Starting upload', { filename: file.name });
try {
  await this.timed('upload', async () => {
    await uploadFile(file);
  });
  logger.info('Upload successful');
} catch (error) {
  logger.error('Upload failed', {
    error: error.message,
    filename: file.name
  });
}
```

```typescript
// Test code
log('INFO', 'Navigating to page', { url: testUrl });
await page.goto(testUrl);
log('INFO', 'Page loaded', { title: await page.title() });
```

## Parsing CI Logs

Since CI logs use JSON format, you can parse them:

```bash
# Extract all errors
cat ci-logs/job-output.log | jq 'select(.level == "ERROR")'

# Get test durations
cat ci-logs/job-output.log | jq 'select(.data.durationMs) | {component, message, duration: .data.durationMs}'

# Count log levels
cat ci-logs/job-output.log | jq -r '.level' | sort | uniq -c
```

## Troubleshooting

### Logs not appearing in CI

1. Check if logs are pushed to branch:
   ```bash
   git pull origin <branch>
   ls -la ci-logs/
   ```

2. Check workflow permissions:
   - `contents: write` required in workflow

3. Check artifacts:
   - Actions → Run → Artifacts section

### Missing structured logs

1. Verify `CI=true` environment variable
2. Check logger import is correct
3. Ensure console output is being captured with `tee`

## Future Enhancements

Potential improvements:
- Log aggregation service integration
- Real-time log streaming
- Log search/filtering UI
- Metrics extraction from logs
- Alert on error patterns
