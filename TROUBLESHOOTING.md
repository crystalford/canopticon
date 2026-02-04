# Automation Troubleshooting Guide

## Common Issues & Solutions

### 🔴 Signals Stay "Pending" (Not Getting Approved)

**Symptoms**:
- Signals created but never move to "approved" status
- Articles not synthesized
- No entries in logs showing signal approval

**Root Cause**:
- Signal scores are 0 (AI analysis didn't run)
- Signal scores don't meet approval thresholds

**Solution**:
1. Check logs for Phase 1:
```sql
SELECT * FROM logs 
WHERE component = 'orchestrator' 
AND message LIKE '%Phase 1%'
ORDER BY created_at DESC LIMIT 10;
```

2. Verify signals have scores:
```sql
SELECT id, status, significanceScore, confidenceScore 
FROM signals 
ORDER BY created_at DESC LIMIT 5;
```

3. If scores are 0, AI analysis didn't run:
   - Check `runSignalAnalysis()` logs
   - Verify AI cost limits aren't hit: `SELECT * FROM ai_usage ORDER BY created_at DESC`
   - Check AI API keys in settings

---

### 🔴 Articles Not Synthesized

**Symptoms**:
- Signals approved but no articles created
- No entries in articles table
- Phase 3 reports 0 articles synthesized

**Root Cause**:
- Signals aren't actually approved
- Synthesis failed silently

**Solution**:
```sql
-- Check if signals are really approved
SELECT COUNT(*) FROM signals WHERE status = 'approved';

-- Check synthesis errors in logs
SELECT * FROM logs 
WHERE component = 'orchestrator'
AND message LIKE '%synthesis%'
ORDER BY created_at DESC;

-- Check AI cost limits
SELECT SUM(CAST(costUsd AS FLOAT)) as total_cost FROM ai_usage 
WHERE DATE(createdAt) = CURRENT_DATE;
```

---

### 🔴 Articles Not Published

**Symptoms**:
- Articles created as drafts
- No articles marked as published
- isDraft = true in database

**Root Cause**:
- Publishing rules not matching
- Article signal not approved
- Publishing rule age check too strict

**Solution**:
1. Check article signals:
```sql
SELECT a.id, a.isDraft, a.signalId, s.status 
FROM articles a
LEFT JOIN signals s ON a.signalId = s.id
WHERE a.isDraft = true
ORDER BY a.createdAt DESC LIMIT 10;
```

2. Verify publishing rule is enabled:
   - Check `src/lib/orchestration/decisions.ts` 
   - Ensure `minArticleAge: 0` (or your desired delay)

3. Check publishing phase logs:
```sql
SELECT * FROM logs
WHERE component = 'orchestrator'
AND message LIKE '%Phase 4%'
ORDER BY created_at DESC;
```

---

### 🔴 Automation Cycle Fails Completely

**Symptoms**:
- API returns 500 error
- cycleId but no stats
- No logs created for any phase

**Root Cause**:
- Database connection error
- Missing imports
- Invalid configuration

**Solution**:
1. Check server logs for stack trace:
```bash
# Look for [AUTOMATION API] Error: in logs
# Stack trace will show exactly where it failed
```

2. Verify database connection:
```sql
SELECT 1;  -- Simple connection test
```

3. Check imports are correct in `workflow.ts`:
```javascript
import { processArticle, runSignalAnalysis } from '@/lib/signals/pipeline'
```

4. Verify tables exist:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

---

### 🟡 Slow Automation Cycle

**Symptoms**:
- Automation takes >30 seconds
- Timeout errors
- High database load

**Root Cause**:
- Batch size too large (processing too many articles)
- AI model latency
- Database indexing issues

**Solution**:
1. Reduce batch size:
```bash
curl -X POST 'http://localhost:3000/api/automation/run?batchSize=5'
```

2. Add database indexes:
```sql
CREATE INDEX idx_raw_articles_processed ON raw_articles(isProcessed, createdAt);
CREATE INDEX idx_signals_status ON signals(status, createdAt);
CREATE INDEX idx_articles_draft ON articles(isDraft, createdAt);
CREATE INDEX idx_clusters_created ON clusters(createdAt DESC);
```

3. Monitor AI API latency:
```sql
SELECT promptName, AVG(inputTokens + outputTokens) as avg_tokens,
       COUNT(*) as count
FROM ai_usage
WHERE DATE(createdAt) = CURRENT_DATE
GROUP BY promptName;
```

---

### 🟡 High AI Costs

**Symptoms**:
- Automation costs more than expected
- Daily costs exceed budget
- Multiple analyses per signal

**Root Cause**:
- Multiple signals being analyzed
- Expensive models used (gpt-4o instead of gpt-4o-mini)
- Cost limits not configured

**Solution**:
1. Set daily cost budget:
```javascript
// In src/lib/ai/cost-control.ts
const DAILY_BUDGET_USD = 10.00;  // Adjust as needed
```

2. Check which models are used:
```sql
SELECT model, COUNT(*) as count, 
       SUM(CAST(costUsd AS FLOAT)) as total
FROM ai_usage
WHERE DATE(createdAt) = CURRENT_DATE
GROUP BY model
ORDER BY total DESC;
```

3. Use cheaper models where possible:
   - Headline: `gpt-4o-mini` ✅
   - Synthesis: Use `gpt-4o-mini` first, `gpt-4o` only for complex cases
   - Tags: `gpt-4o-mini` ✅

---

## Debug Commands

### Quick Status Check
```bash
# Run automation and capture output
curl -X POST http://localhost:3000/api/automation/run 2>&1 | jq .

# Check latest cycle
curl http://localhost:3000/api/automation/status | jq .
```

### Database Queries

```sql
-- Latest cycle stats
SELECT * FROM logs 
WHERE component = 'orchestrator'
ORDER BY createdAt DESC LIMIT 50;

-- Count by status
SELECT status, COUNT(*) FROM signals GROUP BY status;

-- Draft vs published
SELECT COUNT(*) as total, SUM(CASE WHEN isDraft THEN 1 ELSE 0 END) as drafts
FROM articles;

-- AI cost today
SELECT SUM(CAST(costUsd AS FLOAT)) FROM ai_usage 
WHERE DATE(createdAt) = CURRENT_DATE;

-- Recent errors
SELECT * FROM logs WHERE level = 'error' 
ORDER BY createdAt DESC LIMIT 20;
```

### Log Analysis

```bash
# Watch logs in real-time (if using Docker)
docker logs -f canopticon | grep "AUTOMATION\|v0\]"

# Search for specific issues
grep -i "phase.*failed\|synthesis error\|approval failed" logs/*.txt
```

---

## Performance Optimization

### Database Optimization
```sql
-- Check missing indexes
EXPLAIN ANALYZE 
SELECT * FROM raw_articles WHERE isProcessed = false LIMIT 10;

-- Add recommended indexes
CREATE INDEX idx_raw_articles_processed ON raw_articles(isProcessed DESC);
CREATE INDEX idx_signals_status_score ON signals(status, significanceScore DESC);
```

### Batch Processing
```bash
# Process fewer articles per cycle to speed up
curl -X POST 'http://localhost:3000/api/automation/run?batchSize=3'

# Process more articles for bulk operations
curl -X POST 'http://localhost:3000/api/automation/run?batchSize=50'
```

### Cost Optimization
```bash
# Disable AI scoring for testing
curl -X POST 'http://localhost:3000/api/automation/run?enableAIAnalysis=false'

# Lower approval threshold to publish faster
curl -X POST 'http://localhost:3000/api/automation/run?significanceThreshold=40'
```

---

## Manual Testing Workflow

```bash
# 1. Ingest test article
curl -X POST http://localhost:3000/api/ingest/manual \
  -H "Content-Type: application/json" \
  -d '{
    "sourceId": "manual-source",
    "title": "Breaking News Test",
    "bodyText": "This is a substantial test article with enough content to pass quality gates and demonstrate the automation pipeline working end-to-end.",
    "originalUrl": "https://example.com/test-' $(date +%s)'"
  }'

# 2. Run automation
curl -X POST http://localhost:3000/api/automation/run

# 3. Check results
curl http://localhost:3000/api/automation/logs | jq '.cycles[-1]'

# 4. Verify database
# Connect to DB and run:
# SELECT COUNT(*) FROM signals WHERE status = 'approved';
# SELECT COUNT(*) FROM articles WHERE isDraft = false;
```

---

## Monitoring & Alerts

### Key Metrics to Watch
- **Ingestion Rate**: articles per cycle
- **Approval Rate**: percentage of signals approved
- **Synthesis Rate**: articles created from approved signals
- **Publishing Rate**: articles published immediately
- **Error Rate**: failures per 100 runs
- **AI Costs**: USD spent per day

### Setup Simple Monitoring
```sql
-- Daily automation report
SELECT 
  DATE(createdAt) as date,
  SUM(CASE WHEN message LIKE '%processed%' THEN 1 ELSE 0 END) as articles_processed,
  SUM(CASE WHEN message LIKE '%approved%' THEN 1 ELSE 0 END) as signals_approved,
  SUM(CASE WHEN message LIKE '%synthesized%' THEN 1 ELSE 0 END) as articles_made,
  SUM(CASE WHEN message LIKE '%published%' THEN 1 ELSE 0 END) as articles_published
FROM logs
WHERE component = 'orchestrator'
GROUP BY DATE(createdAt)
ORDER BY date DESC
LIMIT 30;
```

