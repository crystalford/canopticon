# Canopticon Automation System

## Overview

Canopticon is now a fully automated political signal detection and synthesis platform. It runs on its own with no manual intervention required.

## Architecture

### The Automation Pipeline

The system operates in independent cycles, each running on a configurable schedule:

```
1. INGESTION CYCLE (every 15 minutes)
   └─ Polls Parliament, PMO, viral sources
   └─ Deduplicates and quality-gates articles
   └─ Stores raw articles in database

2. SIGNAL PROCESSING CYCLE (every 10 minutes)
   └─ Processes pending articles through signal pipeline
   └─ Runs AI classification (breaking, shift, contradiction, repetition)
   └─ Scores confidence and significance
   └─ Auto-approves high-scoring signals based on rules

3. SYNTHESIS CYCLE (every 30 minutes)
   └─ Generates headlines, summaries, tags from approved signals
   └─ Creates article drafts
   └─ Generates video materials and derivative content

4. PUBLISHING CYCLE (every 5 minutes)
   └─ Auto-publishes draft articles based on age and rules
   └─ Triggers social media distribution
   └─ Posts to Bluesky and Mastodon
```

### Key Components

#### `/lib/orchestration/workflow.ts`
Master automation orchestrator that chains all cycles together. Can be triggered manually or via cron.

#### `/lib/orchestration/scheduler.ts`
Redis-based scheduler managing:
- Cycle timing and intervals
- Job execution history
- Automation state (running/paused)
- Configuration management

#### `/lib/orchestration/decisions.ts`
Automated decision engine with:
- Signal approval rules (confidence, significance, type, age)
- Article publishing rules (age, signal approval status)
- Extensible rule system for future customization

#### `/lib/orchestration/logging.ts`
Comprehensive logging system storing logs in:
- Redis (real-time, last 1000 logs)
- PostgreSQL (persistent storage)

#### `/app/api/automation/cron/route.ts`
Called every 5 minutes by Upstash cron trigger. Checks which cycles should run based on their intervals.

### Dashboard

The automation control panel (`/dashboard`) shows:
- Current automation state (running/paused)
- Cycle intervals
- Active approval and publishing rules
- Quick start/stop controls

## Configuration

### Scheduler Config
Edit intervals in `/lib/orchestration/scheduler.ts` `DEFAULT_CONFIG`:
```typescript
{
  ingestionIntervalMinutes: 15,
  signalProcessingIntervalMinutes: 10,
  synthesisIntervalMinutes: 30,
  publishingIntervalMinutes: 5,
}
```

### Approval Rules
Edit signal approval criteria in `/lib/orchestration/decisions.ts` `DEFAULT_APPROVAL_RULES`:
```typescript
{
  name: 'high-confidence-breaking',
  enabled: true,
  conditions: {
    minConfidenceScore: 75,
    minSignificanceScore: 60,
    signalTypes: ['breaking'],
    maxAgeMins: 120,
  },
}
```

### Publishing Rules
Edit article publishing criteria in `/lib/orchestration/decisions.ts` `DEFAULT_PUBLISHING_RULES`:
```typescript
{
  name: 'auto-publish-approved-signals',
  enabled: true,
  conditions: {
    minArticleAge: 5,
    requireApprovedSignal: true,
    autoDeriveContent: true,
  },
}
```

## API Endpoints

### Automation Management
- **GET** `/api/automation/status` - Get current automation state, config, and rules
- **POST** `/api/automation/status` - Update automation state, config, or rules
- **POST** `/api/automation/run` - Manually trigger a full automation cycle
- **POST** `/api/automation/cron` - Called by Upstash cron (requires auth header)

### Monitoring
- **GET** `/api/automation/health` - Health check (200 = healthy, 202 = degraded, 500 = unhealthy)
- **GET** `/api/automation/logs` - Get recent logs with filtering
- **GET** `/api/automation/logs/[cycleId]` - Get logs for a specific cycle

## Setting Up the Cron

1. Connect to Upstash in your Vercel project dashboard
2. Create a cron job that POSTs to `/api/automation/cron` every 5 minutes
3. Set environment variable: `AUTOMATION_CRON_SECRET=<your-secret>`
4. The cron will check if each cycle should run based on configured intervals

### Example Upstash Cron Setup
```
URL: https://your-domain.com/api/automation/cron
Method: POST
Schedule: 0 */5 * * * * (every 5 minutes)
Headers:
  Authorization: Bearer YOUR_SECRET_HERE
  Content-Type: application/json
```

## Deployment Checklist

- [ ] Set `UPSTASH_REDIS_REST_URL` environment variable
- [ ] Set `UPSTASH_REDIS_REST_TOKEN` environment variable
- [ ] Set `AUTOMATION_CRON_SECRET` environment variable
- [ ] Configure Upstash cron job to call `/api/automation/cron` every 5 minutes
- [ ] Test manual trigger: `curl -X POST https://your-domain.com/api/automation/run`
- [ ] Monitor health: `curl https://your-domain.com/api/automation/health`
- [ ] Check logs: `curl https://your-domain.com/api/automation/logs`

## Monitoring & Debugging

### Health Check
```bash
curl https://your-domain.com/api/automation/health
```

### Recent Logs
```bash
curl "https://your-domain.com/api/automation/logs?limit=50"
```

### Component-Specific Logs
```bash
curl "https://your-domain.com/api/automation/logs?component=signal-processing&level=error"
```

### Cycle Logs
```bash
curl "https://your-domain.com/api/automation/logs/cycle-ID"
```

## Troubleshooting

### System Not Running?
1. Check health: `GET /api/automation/health`
2. Verify Upstash Redis credentials
3. Check automation state: `GET /api/automation/status`
4. If paused, toggle: `POST /api/automation/status` with `state: 'running'`

### Signals Not Being Approved?
1. Check approval rules in `/lib/orchestration/decisions.ts`
2. Review signal scores in the database
3. Check logs for signal processing errors: `GET /api/automation/logs?component=signal-processing`

### Articles Not Publishing?
1. Verify articles exist in draft state
2. Check publishing rules meet conditions
3. Review logs: `GET /api/automation/logs?component=publishing`

### High Error Rate?
1. Check health status: `GET /api/automation/health`
2. Review recent errors: `GET /api/automation/logs?level=error`
3. May need to pause, investigate, then resume

## Performance Notes

- Each cycle is independent and runs in parallel
- Total cycle time per 5 minutes: typically < 2 seconds
- Redis stores last 1000 logs for performance
- Database logs persist indefinitely
- Consider archiving old logs after 30+ days

## Future Enhancements

- [ ] Web UI for editing approval/publishing rules
- [ ] Slack/email notifications for errors
- [ ] Performance metrics dashboard
- [ ] A/B testing different rule configurations
- [ ] ML-based signal scoring optimization
- [ ] Integration with external fact-checking APIs
- [ ] Automatic content moderation
