# NEXT STEPS TO LAUNCH AUTOMATION

## 1. Set Environment Variables

Add these to your Vercel project settings (Environment Variables):

```
UPSTASH_REDIS_REST_URL = [Get from Upstash Dashboard]
UPSTASH_REDIS_REST_TOKEN = [Get from Upstash Dashboard]
AUTOMATION_CRON_SECRET = [Generate a random string, e.g., using: openssl rand -hex 32]
```

## 2. Deploy to Vercel

Push your code to GitHub and deploy:
```bash
git add .
git commit -m "Add automation system"
git push origin canopticon-demo
```

Then deploy through Vercel dashboard or use:
```bash
vercel deploy --prod
```

## 3. Set Up Upstash Cron Job

1. Go to your Upstash Console
2. Create a new Scheduled Job (or use existing if you have it)
3. Configure:
   - **URL:** `https://YOUR_DOMAIN/api/automation/cron`
   - **Method:** POST
   - **Headers:**
     ```
     Authorization: Bearer YOUR_AUTOMATION_CRON_SECRET
     Content-Type: application/json
     ```
   - **Body:** `{}` (empty)
   - **Cron:** `0 */5 * * * *` (every 5 minutes)

## 4. Test the System

### Manual Test (Immediate)
```bash
# Trigger one automation cycle manually
curl -X POST https://YOUR_DOMAIN/api/automation/run

# Check health
curl https://YOUR_DOMAIN/api/automation/health

# Check recent logs
curl https://YOUR_DOMAIN/api/automation/logs
```

### Check Automation Status
```bash
curl https://YOUR_DOMAIN/api/automation/status
```

### Control Automation
```bash
# Pause automation
curl -X POST https://YOUR_DOMAIN/api/automation/status \
  -H "Content-Type: application/json" \
  -d '{"action": "setState", "state": "paused"}'

# Resume automation
curl -X POST https://YOUR_DOMAIN/api/automation/status \
  -H "Content-Type: application/json" \
  -d '{"action": "setState", "state": "running"}'
```

## 5. Monitor Dashboard

Go to `/dashboard` in your app. You'll see:
- Current automation state (running/paused)
- Cycle intervals
- Active approval rules
- Active publishing rules
- Control buttons to start/pause automation

## 6. Configure Cycles (Optional)

If you want to adjust cycle intervals, edit `/lib/orchestration/scheduler.ts`:

```typescript
const DEFAULT_CONFIG: SchedulerConfig = {
  ingestionIntervalMinutes: 15,      // How often to poll sources
  signalProcessingIntervalMinutes: 10, // How often to process signals
  synthesisIntervalMinutes: 30,      // How often to synthesize articles
  publishingIntervalMinutes: 5,      // How often to publish articles
}
```

Then redeploy.

## 7. Configure Approval Rules (Optional)

Edit `/lib/orchestration/decisions.ts` to change when signals auto-approve:

```typescript
const DEFAULT_APPROVAL_RULES: ApprovalRule[] = [
  {
    name: 'high-confidence-breaking',
    enabled: true,
    conditions: {
      minConfidenceScore: 75,      // 0-100
      minSignificanceScore: 60,    // 0-100
      signalTypes: ['breaking'],   // breaking, shift, contradiction, repetition
      maxAgeMins: 120,             // Only approve recent signals
    },
  },
  // Add more rules here...
]
```

## 8. Configure Publishing Rules (Optional)

Edit `/lib/orchestration/decisions.ts` to change when articles auto-publish:

```typescript
const DEFAULT_PUBLISHING_RULES: PublishingRule[] = [
  {
    name: 'auto-publish-approved-signals',
    enabled: true,
    conditions: {
      minArticleAge: 5,              // Wait 5 minutes after synthesis
      requireApprovedSignal: true,   // Must have approved signal
      autoDeriveContent: true,       // Auto-generate threads, emails
    },
  },
]
```

## System Overview

After setup, Canopticon will:

1. **Every 15 minutes:** Poll Parliament, PMO, viral sources
2. **Every 10 minutes:** Analyze pending articles, auto-approve high-scoring signals
3. **Every 30 minutes:** Generate articles from approved signals
4. **Every 5 minutes:** Publish draft articles, post to social media

All completely automated. No manual intervention needed.

## Troubleshooting

**Not working?**
1. Check `/api/automation/health`
2. Verify Upstash credentials
3. Check `/api/automation/logs` for errors
4. Ensure cron job is triggering (check Upstash dashboard)

**Want to pause it?**
- Use dashboard toggle or API: `POST /api/automation/status` with `state: 'paused'`

**Need detailed info?**
- See `AUTOMATION_SETUP.md` for full documentation
