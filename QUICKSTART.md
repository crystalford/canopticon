# Quick Start: Running the Fixed Automation

## TL;DR - Just Make It Work

```bash
# 1. Trigger automation
curl -X POST http://localhost:3000/api/automation/run

# 2. Check results (wait 60-90 seconds)
curl http://localhost:3000/api/automation/logs

# 3. Verify in database
# - Signals should have confidence + significance scores
# - Some signals should be "approved"
# - Articles should exist
# - Some articles should have isDraft = false
```

---

## What's Fixed

| Issue | Before | After |
|-------|--------|-------|
| **Signal Scoring** | Signals stuck with 0 scores | Signals analyzed with AI |
| **Approvals** | No signals approved ever | Signals approved by rules |
| **Articles** | No articles created | Articles synthesized & published |
| **Publishing** | Nothing published | Articles published immediately |
| **Debugging** | Silent failures | Comprehensive logs |

---

## Running the Automation

### Option 1: Simple Trigger (No Parameters)
```bash
curl -X POST http://localhost:3000/api/automation/run
```

**Response**:
```json
{
  "success": true,
  "cycleId": "abc123...",
  "stats": {
    "articlesIngested": 5,
    "signalsProcessed": 5,
    "signalsApproved": 3,
    "articlesSynthesized": 3,
    "articlesPublished": 3,
    "socialPostsCreated": 0,
    "errors": []
  }
}
```

### Option 2: Tuned for Testing
```bash
# Process fewer articles (faster testing)
curl -X POST 'http://localhost:3000/api/automation/run?batchSize=3'

# Lower approval threshold (more approvals)
curl -X POST 'http://localhost:3000/api/automation/run?significanceThreshold=50'

# Disable auto-publish (manual review)
curl -X POST 'http://localhost:3000/api/automation/run?enableAutoPublish=false'
```

### Option 3: All Options
```bash
curl -X POST 'http://localhost:3000/api/automation/run' \
  -G \
  -d 'batchSize=5' \
  -d 'significanceThreshold=65' \
  -d 'enableAutoPublish=true'
```

---

## Monitoring Progress

### Real-time Status
```bash
# Check automation status
curl http://localhost:3000/api/automation/status

# View recent logs
curl http://localhost:3000/api/automation/logs | jq '.logs[-20:]'
```

### Database Queries

```bash
# Quick shell script to check progress
sqlite3 (or psql) << 'SQL'
-- Signals status
SELECT status, COUNT(*) FROM signals GROUP BY status;

-- Articles status  
SELECT isDraft, COUNT(*) FROM articles GROUP BY isDraft;

-- Recent errors
SELECT message FROM logs WHERE level = 'error' ORDER BY createdAt DESC LIMIT 5;
SQL
```

---

## Testing Workflow

### 1. Prepare Test Data
```bash
# Add a test article
curl -X POST http://localhost:3000/api/ingest/manual \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "test-source",
    "title": "Breaking News: Major Policy Shift",
    "bodyText": "The government announced a significant policy change today that will affect millions of citizens. This is substantial news content with sufficient length to pass quality gates and demonstrate the full automation pipeline.",
    "originalUrl": "https://example.com/test-article-1"
  }'

# Add another one
curl -X POST http://localhost:3000/api/ingest/manual \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "test-source",
    "title": "Economic Report Released",
    "bodyText": "Today the central bank released its quarterly economic report showing strong growth indicators. This contains sufficient detail for processing through the automation pipeline to create synthesized articles.",
    "originalUrl": "https://example.com/test-article-2"
  }'
```

### 2. Run Automation
```bash
# Trigger automation cycle
RESPONSE=$(curl -s -X POST http://localhost:3000/api/automation/run)
CYCLE_ID=$(echo $RESPONSE | jq -r '.cycleId')

echo "Cycle ID: $CYCLE_ID"
echo $RESPONSE | jq '.stats'
```

### 3. Check Results
```bash
# Check signals were created and scored
SELECT id, status, significanceScore, confidenceScore 
FROM signals 
ORDER BY createdAt DESC 
LIMIT 5;

# Check articles were created
SELECT id, headline, isDraft, publishedAt 
FROM articles 
ORDER BY createdAt DESC 
LIMIT 5;

# Check logs for any errors
SELECT message FROM logs 
WHERE level IN ('error', 'warn')
ORDER BY createdAt DESC 
LIMIT 10;
```

### 4. Expected Results

✅ **Success Indicators**:
- Signals have non-zero scores
- Some signals are "approved"
- Draft articles created (isDraft = true)
- Some articles published (isDraft = false, publishedAt set)
- Logs show all phases completed

❌ **Failure Indicators**:
- Signals still have 0 scores
- All signals are "pending"
- No articles created
- Error messages in logs

---

## Common Issues & Quick Fixes

### Issue: "Signals stay pending"
```sql
-- Check signal scores
SELECT id, significanceScore, confidenceScore, status 
FROM signals ORDER BY createdAt DESC LIMIT 5;

-- If scores are 0: AI analysis didn't run
-- Solution: Check AI API keys and cost limits
SELECT SUM(CAST(costUsd AS FLOAT)) FROM ai_usage;
```

### Issue: "Articles not synthesized"
```sql
-- Check if signals are approved
SELECT COUNT(*) FROM signals WHERE status = 'approved';

-- Check synthesis logs
SELECT * FROM logs 
WHERE component = 'orchestrator'
AND message LIKE '%Phase 3%';
```

### Issue: "Articles not published"
```sql
-- Check draft articles
SELECT id, isDraft FROM articles WHERE isDraft = true;

-- Check publish logs
SELECT * FROM logs 
WHERE component = 'orchestrator'
AND message LIKE '%Phase 4%' OR message LIKE '%publish%';
```

---

## Performance Tips

### For Testing (Fast)
```bash
# Process 1-3 articles at a time
curl -X POST 'http://localhost:3000/api/automation/run?batchSize=1'
```

### For Production (Safe)
```bash
# Process 10 articles per cycle (recommended)
curl -X POST 'http://localhost:3000/api/automation/run?batchSize=10'
```

### For High Volume
```bash
# Process more articles per cycle
# But watch AI costs and database load
curl -X POST 'http://localhost:3000/api/automation/run?batchSize=50'
```

---

## Database Setup (if needed)

If you haven't created the database tables:

```bash
# Run migrations
npm run db:migrate

# Or manually create key tables:
# See src/db/schema.ts for full definitions
```

---

## Logs & Debugging

### View automation logs
```bash
curl http://localhost:3000/api/automation/logs?limit=100 | jq '.logs[] | {time: .createdAt, message}'
```

### Follow logs live (if using Docker)
```bash
docker logs -f canopticon-app | grep -i automation
```

### Query logs for specific phase
```sql
SELECT * FROM logs 
WHERE component = 'orchestrator'
  AND message LIKE '%Phase 2%'
ORDER BY createdAt DESC
LIMIT 20;
```

---

## Success Criteria

After running automation, you should see:

```
Phase 1: ✅ X articles ingested and analyzed
Phase 2: ✅ Y signals approved (X% approval rate)
Phase 3: ✅ Z articles synthesized
Phase 4: ✅ Z articles published
Phase 5: ✅ N social posts created

Total Time: ~60-90 seconds
Success Rate: >90%
Errors: 0-2 (acceptable)
```

---

## Next Steps

1. **Test once**: Verify automation works with these steps
2. **Monitor**: Check logs for errors
3. **Configure**: Adjust thresholds if needed
4. **Scale**: Increase batch size for production
5. **Integrate**: Wire up to cron for scheduled runs

---

## API Reference

```bash
# Trigger automation
POST /api/automation/run

# Query parameters:
# ?batchSize=10 (default: 10)
# ?significanceThreshold=65 (default: 65)
# ?enableAutoPublish=true (default: true)
# ?enableSocialDistribution=true (default: true)

# Get status
GET /api/automation/status

# Get logs
GET /api/automation/logs
GET /api/automation/logs?cycleId=xxx
GET /api/automation/logs/[cycleId]

# Health check
GET /api/automation/health
```

---

## Key Files

- **Workflow**: `src/lib/orchestration/workflow.ts` (main automation loop)
- **Decisions**: `src/lib/orchestration/decisions.ts` (approval/publish rules)
- **Signals**: `src/lib/signals/pipeline.ts` (signal processing)
- **Synthesis**: `src/lib/synthesis/index.ts` (article generation)
- **API**: `src/app/api/automation/run/route.ts` (endpoint)

---

## Support

If automation still doesn't work:

1. Check database connection
2. Verify AI API keys are set
3. Review logs for errors
4. See **TROUBLESHOOTING.md** for detailed debugging
5. See **AUTOMATION_FIXES.md** for technical details

---

**Version**: 2.0 (Fixed)  
**Status**: ✅ Ready to use  
**Last Updated**: 2024

