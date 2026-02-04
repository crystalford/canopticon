# Canopticon Automation Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        UPSTASH CRON                              │
│         Every 5 minutes: POST /api/automation/cron              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   AUTOMATION CRON ENDPOINT                       │
│              (/api/automation/cron/route.ts)                    │
│                                                                  │
│  Checks if each cycle should run based on intervals             │
│  Calls autoApprovePendingSignals() & autoPublishDraftArticles() │
│  Records metrics and logs                                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                ┌────────────┼────────────┐
                │            │            │
                ▼            ▼            ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Workflow │  │Scheduler │  │Decisions │
        │Orchestr. │  │(Redis)   │  │Engine    │
        └──────────┘  └──────────┘  └──────────┘
            │            │                 │
            └────────────┼─────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    ┌──────────────────────────────────────┐
    │         DECISION ENGINE              │
    │  (decisions.ts)                      │
    ├──────────────────────────────────────┤
    │ AUTO-APPROVE SIGNALS:                │
    │ ✓ Check confidence score (75+)       │
    │ ✓ Check significance score (60+)     │
    │ ✓ Check signal type (breaking, etc)  │
    │ ✓ Check age (< 120 mins)             │
    │ → Update signal.status = 'approved'  │
    │                                      │
    │ AUTO-PUBLISH ARTICLES:               │
    │ ✓ Check article age (> 5 mins)       │
    │ ✓ Check signal is approved           │
    │ → Update article.isDraft = false     │
    │ → Set publishedAt timestamp          │
    │ → Trigger social distribution        │
    └──────────────────────────────────────┘


## Data Flow

SOURCES (Parliament, PMO, Viral)
    │
    ├─ Raw Articles ingested
    ├─ Stored in raw_articles table
    │
    ▼
INGESTION CYCLE (every 15 mins)
    │
    ├─ Process unprocessed articles
    ├─ Create clusters
    └─ Create default signals
    │
    ▼
SIGNAL PROCESSING CYCLE (every 10 mins)
    │
    ├─ Get all pending signals
    ├─ Run AI classification
    ├─ Score confidence & significance
    ├─ Check approval rules
    ├─ Auto-approve high-scoring signals
    └─ Update signal.status
    │
    ▼
SYNTHESIS CYCLE (every 30 mins)
    │
    ├─ Get approved signals
    ├─ Generate headline, summary, tags
    ├─ Create article draft
    └─ Generate video materials
    │
    ▼
PUBLISHING CYCLE (every 5 mins)
    │
    ├─ Get draft articles
    ├─ Check publishing rules
    ├─ Auto-publish ready articles
    ├─ Trigger social distribution
    └─ Post to Bluesky & Mastodon
    │
    ▼
PUBLIC SITE & SOCIAL MEDIA
    └─ Articles visible on /articles
    └─ Threads on Bluesky
    └─ Toots on Mastodon


## State Management

Each cycle tracks state in Redis:

```
automation:state = 'running' | 'paused'

automation:lastrun:ingestion = <timestamp>
automation:lastrun:signal-processing = <timestamp>
automation:lastrun:synthesis = <timestamp>
automation:lastrun:publishing = <timestamp>

automation:config = {
  ingestionIntervalMinutes: 15,
  signalProcessingIntervalMinutes: 10,
  synthesisIntervalMinutes: 30,
  publishingIntervalMinutes: 5,
}

automation:executions:<job> = [
  { status, duration, timestamp, ... },
  ...
]

automation:logs = [
  { component, level, message, cycleId, metadata, ... },
  ...
]
```


## Key Integration Points

### Database Tables
- sources: Political news sources
- raw_articles: Ingested articles
- clusters: Related article groups
- signals: Classified events (pending→approved→archived)
- articles: Published synthesized articles
- logs: Operation logs

### External Services
- Upstash Redis: State, scheduling, logs
- PostgreSQL: Persistent data storage
- Bluesky API: Social distribution
- Mastodon API: Social distribution
- AI SDK: Signal classification

### Configuration Points
```typescript
// Edit these to customize behavior:
DEFAULT_APPROVAL_RULES    // /lib/orchestration/decisions.ts
DEFAULT_PUBLISHING_RULES  // /lib/orchestration/decisions.ts
DEFAULT_CONFIG            // /lib/orchestration/scheduler.ts
```


## Monitoring & Observability

### Health Check (`GET /api/automation/health`)
```json
{
  "status": "healthy",
  "lastCycleRun": "2024-01-15T10:30:00Z",
  "recentErrors": 0,
  "recentWarnings": 1,
  "timestamp": "2024-01-15T10:35:00Z"
}
```

### Logs (`GET /api/automation/logs`)
```json
{
  "logs": [
    {
      "id": "1705319400000-0.123",
      "timestamp": "2024-01-15T10:30:00Z",
      "component": "signal-processing",
      "level": "info",
      "message": "Signal approved",
      "cycleId": "abc-123",
      "metadata": { "signalId": "xyz", "score": 78 }
    }
  ],
  "total": 1
}
```

### Dashboard (`/dashboard`)
- Current state
- Cycle intervals
- Approval rules
- Publishing rules
- Start/pause controls


## Failure Handling

Each cycle is independent:
- If ingestion fails, signal processing still runs
- If synthesis fails, publishing still runs
- Failed cycles are logged, next run attempts again
- Can pause system with single flag: `state: 'paused'`
- Can manually trigger: `POST /api/automation/run`


## Performance Characteristics

- Cron triggered: 5-minute intervals
- Each cycle: < 2 seconds execution time
- Redis: O(1) lookups, O(n) where n = 1000 max logs
- Database: Indexed queries on signals/articles
- Total throughput: 1000+ signals/day sustainable
- Cost: Minimal (serverless, Redis-only)
