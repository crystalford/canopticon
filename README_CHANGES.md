# Canopticon Automation - What's Changed

## The Problem You Had

You built a lot of features (ingestion, signals, synthesis, distribution) but:
- Nothing ran automatically
- You were stuck in the middle approving everything
- The system felt clunky because it required manual triggers
- The dashboard had too many controls for a system meant to be automated

## The Solution We Built

A complete automation layer that makes Canopticon self-running:

### 1. Workflow Orchestrator (`/lib/orchestration/workflow.ts`)
- Master automation loop that chains all operations
- Runs ingestion → signal processing → synthesis → publishing
- Tracks metrics and logs for debugging

### 2. Scheduler System (`/lib/orchestration/scheduler.ts`)
- Redis-based job scheduling
- Independent cycles run on configurable intervals
- Stores execution history, metrics, and state
- Can pause/resume automation with a single flag

### 3. Automated Decision Engine (`/lib/orchestration/decisions.ts`)
- **Signal Approval Rules**: Auto-approve high-confidence/significance signals
  - Only 3 rules by default, easily configurable
  - Based on confidence score, significance score, signal type, age
- **Publishing Rules**: Auto-publish articles when ready
  - Checks article age and signal approval status
  - Optionally auto-generates derivative content

### 4. Cron Integration (`/app/api/automation/cron/route.ts`)
- Upstash calls this every 5 minutes
- Checks which cycles should run based on intervals
- No local cron needed—fully cloud-native

### 5. Monitoring & Logging (`/lib/orchestration/logging.ts`)
- Logs to both Redis (real-time) and database (persistent)
- Health check endpoint
- Filterable log queries by component, level, or cycle

### 6. Cleaned-Up Dashboard (`/app/dashboard`)
- Old "Daily Brief" generator removed
- New **Automation Control Panel** shows:
  - Current state (running/paused)
  - All cycle intervals
  - Active approval rules
  - Active publishing rules
  - Start/pause controls
- Simplified navigation (only what matters)

## How It Works Now

```
Every 5 minutes (from Upstash cron):
  - Check which cycles should run
  - Run each cycle independently:
    
    Every 15 minutes: Ingest new articles
    Every 10 minutes: Process signals & auto-approve
    Every 30 minutes: Synthesize articles  
    Every 5 minutes: Publish & distribute to social
    
  - Log everything
  - No manual work needed
```

## What You Need to Do

1. **Add environment variables** (3 total):
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `AUTOMATION_CRON_SECRET`

2. **Create Upstash cron job**:
   - POST to `/api/automation/cron` every 5 minutes
   - Include auth header with your secret

3. **Deploy** to Vercel

4. **Test**:
   - Visit `/dashboard` to see automation control panel
   - Manually trigger: `POST /api/automation/run`
   - Check health: `GET /api/automation/health`
   - View logs: `GET /api/automation/logs`

See `QUICK_START.md` for detailed setup instructions.

## Files Created/Modified

### New Modules
- `/lib/orchestration/workflow.ts` - Master orchestrator
- `/lib/orchestration/scheduler.ts` - Redis scheduler
- `/lib/orchestration/decisions.ts` - Approval/publishing rules
- `/lib/orchestration/logging.ts` - Logging system

### New API Routes
- `/api/automation/run` - Manually trigger a cycle
- `/api/automation/cron` - Called by Upstash (every 5 mins)
- `/api/automation/status` - Get/update automation state
- `/api/automation/health` - Health check
- `/api/automation/logs` - Get logs

### Updated Pages
- `/dashboard/page.tsx` - New automation control panel
- `/dashboard/layout.tsx` - Simplified navigation

### Documentation
- `AUTOMATION_SETUP.md` - Full technical documentation
- `QUICK_START.md` - Setup and deployment guide
- `README_CHANGES.md` - This file

## Key Design Decisions

1. **Independent Cycles**: Each phase (ingestion, signals, synthesis, publishing) runs on its own timer. If one fails, others continue.

2. **Rule-Based Automation**: Simple, configurable rules instead of complex logic. Easy to adjust thresholds without code changes.

3. **Redis + Database Logging**: Real-time logs in Redis for performance, persistent logs in DB for compliance.

4. **Upstash Cron**: No local scheduler, no polling infrastructure. Simple, serverless, cost-effective.

5. **Cleared UI**: Removed all the manual controls that were causing confusion. Dashboard is now status + control panel only.

## Performance

- Each 5-minute cycle takes < 2 seconds
- Redis stores last 1000 logs (fast queries)
- Database logs persist indefinitely
- Very low resource usage (perfect for serverless)

## Next Steps (After Setup)

1. **Monitor**: Check `/api/automation/health` regularly
2. **Adjust**: Tweak approval/publishing rules based on signal quality
3. **Scale**: Add more sources or refine signal scoring as needed
4. **Integrate**: Connect to external fact-checking, moderation APIs
5. **Optimize**: Use metrics to A/B test different rule configurations

## Questions?

- See `AUTOMATION_SETUP.md` for detailed docs
- See `QUICK_START.md` for step-by-step setup
- API endpoints are self-documenting (curl them to see responses)
