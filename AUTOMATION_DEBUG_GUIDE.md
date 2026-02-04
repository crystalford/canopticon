# Article Ingestion & Automation Debug Guide

## Overview
The automation system has 5 phases that must work together:

1. **Ingestion** - Raw articles are fetched/submitted
2. **Signal Pipeline** - Articles are clustered and signals created (pending)
3. **AI Analysis** - Signals are scored with AI (confidence + significance)
4. **Auto-Approval** - Signals matching rules are approved
5. **Synthesis** - Approved signals become articles
6. **Publishing** - Draft articles are published

## Common Issues & Fixes

### Issue 1: Manual Ingestion Not Working
**Symptoms**: Dashboard shows no ingestion activity, console shows errors

**Debug Steps**:
1. Check browser console for errors when clicking "RUN CYCLE"
2. Check server logs for `[v0]` prefixed messages:
   - Should see: `[v0] Automation cycle triggered`
   - Should see: `[v0] Phase 1: Processing X unprocessed articles`
3. Verify database has `raw_articles` records:
   ```sql
   SELECT COUNT(*) FROM raw_articles WHERE is_processed = false;
   ```

**Fix**:
- Ensure the manual ingestion endpoint is receiving URLs correctly
- Check that `src/lib/scraper-util.ts` has `extractArticleContent()` working
- Verify OpenAI API key is set in environment variables

---

### Issue 2: Signals Created But Not Analyzed
**Symptoms**: Signals exist with 0 confidence/significance scores

**Root Cause**: AI analysis is failing silently

**Debug**:
1. Check logs table for analysis errors:
   ```sql
   SELECT message FROM logs WHERE component = 'signal-pipeline' 
   AND level = 'error' ORDER BY created_at DESC LIMIT 5;
   ```
2. Check if OpenAI/Claude API keys are configured:
   ```sql
   SELECT key, value FROM system_settings 
   WHERE key LIKE '%API_KEY%' OR key LIKE '%PROVIDER%';
   ```

**Fixes**:
- **If API key missing**: Set `OPENAI_API_KEY` in environment variables
- **If API key wrong**: Update in Vercel environment variables
- **If rate limited**: Wait 60 seconds and try again
- **If model error**: Check `src/lib/ai/client.ts` for model names

---

### Issue 3: Signals Not Auto-Approved
**Symptoms**: Signals have scores but status stays "pending"

**Root Cause**: Approval rules too strict OR signal scores too low

**Debug**:
1. Check signal scores:
   ```sql
   SELECT id, signal_type, confidence_score, significance_score, status 
   FROM signals ORDER BY created_at DESC LIMIT 10;
   ```
2. Check what rules exist:
   - In code: `src/lib/orchestration/decisions.ts`
   - Current rules require confidence ≥ 50, significance ≥ 50

**Expected Behavior After Fix**:
- Signals with confidence ≥ 50 AND significance ≥ 50 should auto-approve
- Signals with type='breaking' AND confidence ≥ 75, significance ≥ 60 should auto-approve immediately

**If Still Not Approving**:
- Scores might be lower than expected → Run manual test
- Rules might not match signal type → Check signal_type in database

---

### Issue 4: Approved Signals But No Articles Synthesized
**Symptoms**: Dashboard shows signals approved, but no articles created

**Debug**:
1. Check for approved signals:
   ```sql
   SELECT id, signal_type, significance_score FROM signals 
   WHERE status = 'approved' ORDER BY created_at DESC LIMIT 5;
   ```
2. Check if articles were created:
   ```sql
   SELECT id, headline, is_draft FROM articles 
   WHERE is_draft = true ORDER BY created_at DESC LIMIT 5;
   ```
3. Check synthesis errors:
   ```sql
   SELECT message FROM logs WHERE component = 'orchestrator' 
   AND message LIKE '%Phase 3%' ORDER BY created_at DESC LIMIT 5;
   ```

**Fixes**:
- **If no articles despite approved signals**: Synthesis AI is failing
  - Check OpenAI API quota (gpt-4o is expensive)
  - Check cost limits in `src/lib/ai/cost-control.ts`
  - Try running with cheaper model in code

---

### Issue 5: Articles Synthesized But Not Published
**Symptoms**: Articles exist with `is_draft = true` but aren't published

**Debug**:
1. Check draft articles:
   ```sql
   SELECT id, headline, published_at, is_draft FROM articles 
   WHERE is_draft = true ORDER BY created_at DESC LIMIT 5;
   ```
2. Check publishing logs:
   ```sql
   SELECT message FROM logs WHERE component = 'orchestrator' 
   AND message LIKE '%Phase 4%' ORDER BY created_at DESC LIMIT 5;
   ```

**Fixes**:
- Publishing happens immediately after synthesis in current config
- If articles still draft, check `src/lib/orchestration/decisions.ts` publishing rules
- Rule `auto-publish-approved-signals` must be enabled

---

## Complete Workflow Test

### Step 1: Submit a URL
```bash
curl -X POST http://localhost:3000/api/ingest/manual \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/article"}'
```

Expected response:
```json
{
  "success": true,
  "articleId": "...",
  "pipeline": { "processed": 1, "created": 1, "merged": 0, "errors": 0 }
}
```

### Step 2: Check Raw Article Created
```sql
SELECT id, title, is_processed FROM raw_articles 
ORDER BY created_at DESC LIMIT 1;
```

Should show: `is_processed = false`

### Step 3: Run Automation Cycle
Click "RUN CYCLE" button on dashboard OR:
```bash
curl -X POST http://localhost:3000/api/automation/run
```

### Step 4: Check Progress
Watch logs real-time:
```sql
SELECT * FROM logs WHERE run_id = '[cycleId]' 
ORDER BY created_at DESC;
```

Expected sequence:
1. `message: 'Automation cycle started'`
2. `message: 'Processing article (Manual Mode)'` (Phase 1)
3. `message: 'Analysis complete'` (if scores high enough)
4. `message: 'Signal evaluated'` (Phase 2)
5. `message: 'Article synthesized'` (Phase 3)
6. `message: 'Article published'` (Phase 4)
7. `message: 'Automation cycle completed'`

---

## Key Database Queries

**See everything created in last 5 minutes**:
```sql
SELECT 'raw_articles' as type, COUNT(*) as count FROM raw_articles 
WHERE created_at > NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT 'signals', COUNT(*) FROM signals 
WHERE created_at > NOW() - INTERVAL '5 minutes'
UNION ALL
SELECT 'articles', COUNT(*) FROM articles 
WHERE created_at > NOW() - INTERVAL '5 minutes';
```

**Check signal approval status**:
```sql
SELECT 
  signal_type,
  status,
  AVG(confidence_score) as avg_confidence,
  AVG(significance_score) as avg_significance,
  COUNT(*) as count
FROM signals
GROUP BY signal_type, status
ORDER BY created_at DESC;
```

**See all errors**:
```sql
SELECT component, level, message, COUNT(*) as count
FROM logs
WHERE level = 'error'
GROUP BY component, level, message
ORDER BY created_at DESC
LIMIT 20;
```

---

## Environment Variables Needed

Ensure these are set in Vercel:
- `OPENAI_API_KEY` - Required for AI analysis and synthesis
- `DATABASE_URL` - Provided by integration
- `ANTHROPIC_API_KEY` - Optional (if using Claude instead)

## Console Logging

All fixes include enhanced `console.log("[v0] ...")` statements. You should see these in:
- **Dashboard**: Browser developer console (F12)
- **Backend**: Vercel logs → Functions tab

Look for patterns:
- `[v0] Phase 1:` - Ingestion phase
- `[v0] Created signal` - Signal creation  
- `[v0] Analysis complete` - Scoring done
- `[v0] Synthesizing article` - Article generation
- `[v0] Article synthesized` - Success

---

## Quick Checklist

- [ ] OpenAI API key is set
- [ ] Database is connected (see tables with data)
- [ ] Can submit URL manually via API
- [ ] Raw article appears in database
- [ ] Run automation cycle on dashboard
- [ ] Check logs table for errors
- [ ] Look for `[v0]` prefixed console messages
- [ ] Verify signal scores are populated (not 0)
- [ ] Confirm signals status changed from pending→approved
- [ ] Check articles table for synthesized content
- [ ] Verify articles are published (is_draft = false)
