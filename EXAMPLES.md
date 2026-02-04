# Automation Examples & Common Tasks

## Manual Testing

### Test 1: Trigger One Cycle
```bash
curl -X POST https://YOUR_DOMAIN/api/automation/run
```

### Test 2: Check System Health
```bash
curl https://YOUR_DOMAIN/api/automation/health
```

Expected response:
```json
{
  "status": "healthy",
  "lastCycleRun": "2024-01-15T10:30:00Z",
  "recentErrors": 0,
  "recentWarnings": 0,
  "timestamp": "2024-01-15T10:35:00Z"
}
```

### Test 3: View Recent Logs
```bash
curl "https://YOUR_DOMAIN/api/automation/logs?limit=10"
```

### Test 4: Get Error Logs Only
```bash
curl "https://YOUR_DOMAIN/api/automation/logs?level=error&limit=20"
```

### Test 5: Get Logs for Specific Component
```bash
curl "https://YOUR_DOMAIN/api/automation/logs?component=signal-processing&limit=50"
```

## Configuration Examples

### Example 1: Aggressive Signal Approval
For more articles published faster, lower thresholds:

```typescript
// /lib/orchestration/decisions.ts
const DEFAULT_APPROVAL_RULES: ApprovalRule[] = [
  {
    name: 'aggressive-all-signals',
    enabled: true,
    conditions: {
      minConfidenceScore: 50,      // Lower threshold
      minSignificanceScore: 40,    // Lower threshold
      signalTypes: ['breaking', 'shift', 'contradiction', 'repetition'],
      maxAgeMins: 240,             // Longer window
    },
  },
]
```

### Example 2: Conservative Signal Approval
For fewer but higher-quality articles:

```typescript
const DEFAULT_APPROVAL_RULES: ApprovalRule[] = [
  {
    name: 'high-quality-only',
    enabled: true,
    conditions: {
      minConfidenceScore: 90,      // High threshold
      minSignificanceScore: 85,    // High threshold
      signalTypes: ['breaking'],   // Only breaking signals
      maxAgeMins: 60,              // Recent only
    },
  },
]
```

### Example 3: Fast Publishing
Publish articles almost immediately after synthesis:

```typescript
const DEFAULT_PUBLISHING_RULES: PublishingRule[] = [
  {
    name: 'instant-publish',
    enabled: true,
    conditions: {
      minArticleAge: 1,            // 1 minute wait
      requireApprovedSignal: false, // Don't require approval
      autoDeriveContent: true,
    },
  },
]
```

### Example 4: Slow, Careful Publishing
Wait longer to ensure quality:

```typescript
const DEFAULT_PUBLISHING_RULES: PublishingRule[] = [
  {
    name: 'careful-publish',
    enabled: true,
    conditions: {
      minArticleAge: 30,           // 30 minute wait
      requireApprovedSignal: true, // Must have approval
      autoDeriveContent: true,
    },
  },
]
```

## Operational Tasks

### Pause All Automation
```bash
curl -X POST https://YOUR_DOMAIN/api/automation/status \
  -H "Content-Type: application/json" \
  -d '{
    "action": "setState",
    "state": "paused"
  }'
```

### Resume Automation
```bash
curl -X POST https://YOUR_DOMAIN/api/automation/status \
  -H "Content-Type: application/json" \
  -d '{
    "action": "setState",
    "state": "running"
  }'
```

### Change Cycle Intervals
```bash
curl -X POST https://YOUR_DOMAIN/api/automation/status \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "ingestionIntervalMinutes": 30,
      "signalProcessingIntervalMinutes": 20,
      "synthesisIntervalMinutes": 60,
      "publishingIntervalMinutes": 10
    }
  }'
```

### Get Current Configuration
```bash
curl https://YOUR_DOMAIN/api/automation/status
```

Response:
```json
{
  "state": "running",
  "config": {
    "ingestionIntervalMinutes": 15,
    "signalProcessingIntervalMinutes": 10,
    "synthesisIntervalMinutes": 30,
    "publishingIntervalMinutes": 5
  },
  "rules": {
    "approval": [...],
    "publishing": [...]
  },
  "timestamp": 1705319400000
}
```

## Debugging

### Find Failed Cycles
```bash
curl "https://YOUR_DOMAIN/api/automation/logs?level=error" | jq '.logs[] | {component, message, metadata}'
```

### See What's Happening Now
```bash
curl "https://YOUR_DOMAIN/api/automation/logs?limit=5" | jq -r '.logs[] | "\(.timestamp) [\(.component)] \(.message)"'
```

### Get Logs for Last 100 Items
```bash
curl "https://YOUR_DOMAIN/api/automation/logs?limit=100"
```

### Filter by Component
```bash
# Ingestion logs
curl "https://YOUR_DOMAIN/api/automation/logs?component=ingestion"

# Signal processing logs
curl "https://YOUR_DOMAIN/api/automation/logs?component=signal-processing"

# Publishing logs
curl "https://YOUR_DOMAIN/api/automation/logs?component=publishing"
```

## Monitoring Queries

### Signal Approval Rate
```bash
# Get last 50 signal-processing logs
curl "https://YOUR_DOMAIN/api/automation/logs?component=signal-processing&limit=50" | \
  jq '[.logs[] | select(.message | contains("approved"))] | length'
```

### Article Publishing Rate
```bash
# Get last 50 publishing logs
curl "https://YOUR_DOMAIN/api/automation/logs?component=publishing&limit=50" | \
  jq '[.logs[] | select(.message | contains("Published"))] | length'
```

### Recent Errors
```bash
curl "https://YOUR_DOMAIN/api/automation/logs?level=error&limit=20" | \
  jq '.logs[] | {time: .timestamp, error: .message, component}'
```

## Database Queries (for advanced use)

### Get All Pending Signals
```sql
SELECT id, signal_type, confidence_score, significance_score, created_at 
FROM signals 
WHERE status = 'pending' 
ORDER BY created_at DESC 
LIMIT 20;
```

### Get All Draft Articles
```sql
SELECT id, headline, signal_id, created_at 
FROM articles 
WHERE is_draft = true 
ORDER BY created_at DESC 
LIMIT 20;
```

### Get Articles Published Today
```sql
SELECT id, headline, published_at 
FROM articles 
WHERE published_at >= NOW() - INTERVAL '1 day' 
ORDER BY published_at DESC;
```

### Count Approved Signals by Type
```sql
SELECT signal_type, COUNT(*) 
FROM signals 
WHERE status = 'approved' 
AND created_at >= NOW() - INTERVAL '24 hours' 
GROUP BY signal_type;
```

## Using the Dashboard

### Dashboard Features
1. **Automation Control**: Toggle running/paused state
2. **Status Cards**: Shows intervals for each cycle
3. **Approval Rules**: Shows active signal approval rules with their thresholds
4. **Publishing Rules**: Shows active article publishing rules
5. **How It Works**: Quick reference for the automation flow

### Making Changes
1. For cycle intervals: Edit `scheduler.ts` and redeploy
2. For approval rules: Edit `decisions.ts` and redeploy
3. For publishing rules: Edit `decisions.ts` and redeploy
4. To pause temporarily: Use dashboard toggle (no redeploy needed)

## Troubleshooting Commands

### Is it running?
```bash
curl https://YOUR_DOMAIN/api/automation/status | jq '.state'
```

### Are there errors?
```bash
curl "https://YOUR_DOMAIN/api/automation/logs?level=error" | jq '.logs | length'
```

### When did it last run?
```bash
curl "https://YOUR_DOMAIN/api/automation/logs?limit=5" | jq -r '.logs[0].timestamp'
```

### Get system health score
```bash
curl https://YOUR_DOMAIN/api/automation/health | jq '{status, recentErrors, recentWarnings}'
```

## Production Checklist

- [ ] Health check passes: `GET /api/automation/health`
- [ ] Recent logs show no errors: `GET /api/automation/logs?level=error`
- [ ] Cron job is firing: Check Upstash dashboard
- [ ] Dashboard shows "RUNNING" state
- [ ] Manual test cycle succeeded: `POST /api/automation/run`
- [ ] Articles are appearing: Check `/articles`
- [ ] Social posts appearing: Check Bluesky/Mastodon
- [ ] Monitor logs for 24 hours: `GET /api/automation/logs`
