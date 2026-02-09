-- Social Monitors Table
CREATE TABLE IF NOT EXISTS "social_monitors" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "account_handle" text NOT NULL,
    "account_id" text,
    "display_name" text,
    "enabled" boolean DEFAULT true NOT NULL,
    "monitor_type" text NOT NULL,
    "config" jsonb DEFAULT '{"autoReply": false, "requireApproval": true, "maxRepliesPerDay": 10, "fallacyTypes": []}'::jsonb NOT NULL,
    "last_checked_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Tracked Tweets Table
CREATE TABLE IF NOT EXISTS "tracked_tweets" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "tweet_id" text NOT NULL UNIQUE,
    "monitor_id" uuid NOT NULL REFERENCES "social_monitors"("id") ON DELETE CASCADE,
    "author_handle" text NOT NULL,
    "author_name" text,
    "content" text NOT NULL,
    "url" text NOT NULL,
    "analyzed" boolean DEFAULT false NOT NULL,
    "fallacies_detected" jsonb,
    "reply_status" text DEFAULT 'pending' NOT NULL,
    "reply_draft" text,
    "reply_tweet_id" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "analyzed_at" timestamp,
    "replied_at" timestamp
);
