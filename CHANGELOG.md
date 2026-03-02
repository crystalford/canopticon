# Canopticon Changelog

Changes are recorded here so that regressions can be identified across context windows.
Most recent changes at the top.

---

## 2026-03-02 — Video pipeline refactor (video-first, article-free)

### Goal
Strip article generation out of the clip flow entirely. Focus: monitor a YouTube channel → clip the best moment → post native video to X (and optionally Bluesky, Threads, TikTok).

### Changes

**`src/lib/social/cloudinary.ts`** (created)
- Shared `transcodeForTwitter(buffer, logPrefix)` utility
- Converts video to H.264 baseline / AAC / MP4 via Cloudinary eager transform
- `fl_faststart` removed — it is NOT a valid Cloudinary flag; Cloudinary MP4 output is already moov-atom-first (faststart) by default
- Eager: `vc_h264:baseline:3.1,ac_aac,f_mp4`

**`src/lib/videos/pipeline.ts`** (heavily refactored)
- Removed article generation (`generateClipArticle`) and the `clipArticle` config flag from `onClipReady`
- Removed `articles` import (no longer needed)
- Added `fetchYouTubeTranscriptDirect` — bracket-counting to safely extract nested JSON from YouTube page source (replaces fragile regex approach)
- Added `fetchTranscriptViaApify` — Apify polling fallback (18 × 5s = 90s max, no webhook)
- Added `fetchTranscript` — cascade: tries direct YouTube first, falls back to Apify polling
- Added `startAsyncClipProcessing` — fast path for YouTube webhook/cron auto runs; creates DB record + fires Apify transcript actor with webhook callback, returns immediately
- `queueVideoClip` — synchronous path for manual clips; calls `fetchTranscript` cascade → Claude → Apify clipper
- `runVideoMonitor` — now calls `startAsyncClipProcessing` (was `queueVideoClip`) to avoid blocking cron for 90s
- Added Cloudinary transcoding in `onClipReady` before X video upload

**`src/app/api/webhooks/youtube/route.ts`**
- `video_monitor` branch now calls `startAsyncClipProcessing` instead of `queueVideoClip`
- Webhook handler responds fast; transcript/clip work happens asynchronously via Apify webhooks

**`src/app/api/video-monitors/route.ts`**
- POST handler auto-subscribes to YouTube PubSubHubbub on monitor creation
- Subscription: `hub.callback = /api/webhooks/youtube`, `hub.lease_seconds = 864000` (10 days)
- YouTube pushes real-time video notifications instead of RSS polling

**`src/app/api/video-monitors/[id]/clip-video/route.ts`**
- `maxDuration` increased from 60 → 120 (needed for Apify polling fallback in `fetchTranscriptViaApify`)

**`src/app/api/videos/[id]/post-x/route.ts`**
- Removed local `transcodeForTwitter` function; now imports from `@/lib/social/cloudinary`

**`src/app/(app)/videos/page.tsx`**
- `STATUS_LABEL` record replaced with dynamic `statusLabel(clip)` function:
  - `queued` → "Fetching transcript..."
  - `processing` (no startSeconds) → "Analyzing transcript..."
  - `processing` (has startSeconds) → "Cutting video clip..."
  - `done` → "Ready" | `failed` → "Failed"
- Clip cards show rationale, key quote, tweet draft even while processing
- Platform post errors shown prominently with AlertTriangle icon
- Poll interval reduced from 8s → 5s while clips are active

### Architecture decisions
- **Two processing paths**: manual clips use sync polling (~30-90s), auto clips use async webhook path (fast)
- **Cascade transcript**: direct YouTube → Apify polling fallback (YouTube blocks cloud IPs sometimes)
- **No articles from clips**: clip flow is now: transcript → Claude selects window → Apify clips → Cloudinary transcodes → post to X

---

## Earlier sessions (pre-CHANGELOG)

- Apify `fractalai~youtube-video-clipper` wired for video clipping
- Apify `leandrocb88~youtube-video-transcript-scraper` for transcript (webhook-based, replaced with polling for manual path)
- YouTube PubSubHubbub subscribe/verify/push flow established
- Drizzle schema: `videoClips` table with status, xPostedAt, tiktokPostId, blueskyPostId, threadsPostId, errorMessage, transcriptSegment, etc.
- Twitter video upload via `twitter-api-v2` v1 upload API
