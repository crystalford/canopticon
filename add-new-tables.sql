-- Add new tables for AI provider management system
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS "ai_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"api_key" text NOT NULL,
	"config" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"prompt_text" text NOT NULL,
	"variables" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pipeline_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task" text NOT NULL,
	"provider_id" uuid NOT NULL,
	"model" text NOT NULL,
	"prompt_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "generation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid,
	"task" text NOT NULL,
	"provider_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"tokens_used" integer,
	"cost_usd" text,
	"duration_ms" integer,
	"status" text NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign keys (if tables already exist, these may fail - that's OK, just ignore errors)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'generation_runs_article_id_articles_id_fk'
    ) THEN
        ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_article_id_articles_id_fk"
            FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'generation_runs_provider_id_ai_providers_id_fk'
    ) THEN
        ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_provider_id_ai_providers_id_fk"
            FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'generation_runs_prompt_id_prompts_id_fk'
    ) THEN
        ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_prompt_id_prompts_id_fk"
            FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_config_provider_id_ai_providers_id_fk'
    ) THEN
        ALTER TABLE "pipeline_config" ADD CONSTRAINT "pipeline_config_provider_id_ai_providers_id_fk"
            FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE no action ON UPDATE no action;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_config_prompt_id_prompts_id_fk'
    ) THEN
        ALTER TABLE "pipeline_config" ADD CONSTRAINT "pipeline_config_prompt_id_prompts_id_fk"
            FOREIGN KEY ("prompt_id") REFERENCES "prompts"("id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;
