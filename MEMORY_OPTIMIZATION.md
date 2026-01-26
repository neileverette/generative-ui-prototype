# Memory Optimization Guide

This project includes automatic memory management for the Playwright browser scraper to prevent excessive disk and memory usage.

## Automatic Cleanup

The auto-scraper (`server/claude-scraper/auto-scraper.ts`) automatically cleans up browser cache:

- **Frequency**: Every 12 scraper runs (~1 hour with 5-minute intervals)
- **Threshold**: When session cache exceeds 50MB
- **What's cleaned**: Browser cache, code cache, service worker cache (cookies and auth are preserved)

## Manual Cleanup

To manually clean the browser cache:

```bash
npx tsx server/claude-scraper/cleanup-cache.ts --verbose
```

This will:
- Clear browser cache directories
- Free up 50-70MB typically
- Preserve authentication cookies and session data

## What's Being Managed

### Automatically Cleaned
- `server/claude-scraper/.session/Default/Cache/` - Browser HTTP cache
- `server/claude-scraper/.session/Default/Code Cache/` - V8 JavaScript cache
- `server/claude-scraper/.session/GraphiteDawnCache/` - WebGL cache
- Test artifacts (`test-results/`, `playwright-report/`)

### Should Be Cleaned Manually When Needed
- `dist/` - Build output (16MB) - Run `npm run build` to regenerate
- `node_modules/` - Dependencies (786MB) - Run `npm install` to regenerate

### Ignored by Git
All cache directories are now in `.gitignore`:
- `server/claude-scraper/.session/`
- `test-results/`
- `playwright-report/`

## Monitoring

The auto-scraper logs cleanup operations:

```
[Auto-Scraper] Cache cleanup: freed 66.41 MB
```

Use `--verbose` flag for detailed cleanup information.

## Troubleshooting

If you're still experiencing memory issues:

1. **Check for running processes**:
   ```bash
   ps aux | grep node
   ```

2. **Clean all build artifacts**:
   ```bash
   rm -rf dist test-results playwright-report
   npm run build
   ```

3. **Reinstall dependencies** (if needed):
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Check disk usage**:
   ```bash
   du -sh .git node_modules server/claude-scraper/.session dist
   ```

## Configuration

To adjust cleanup behavior, edit `server/claude-scraper/auto-scraper.ts`:

```typescript
const CLEANUP_INTERVAL_RUNS = 12; // Runs between cleanups
const CLEANUP_THRESHOLD_MB = 50;   // Size threshold in MB
```
