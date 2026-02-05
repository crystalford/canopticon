-- Setup Canopticon Database Schema
-- This script creates all tables and enums for the Canopticon system

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE signal_type AS ENUM (
    'breaking',
    'repetition',
    'contradiction',
    'shift'
);

CREATE TYPE signal_status AS ENUM (
    'pending',
    'flagged',
    'approved',
    'archived'
);

CREATE TYPE analysis_severity AS ENUM (
    'low',
    'medium',
    'high'
);

CREATE TYPE subscriber_status AS ENUM (
    'pending',
    'subscribed',
    'unsubscribed'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- 3.1 Sources
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    protocol TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    polling_interval TEXT DEFAULT '1 hour',
    reliability_weight INTEGER DEFAULT 50 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3.2 Raw Articles
CREATE TABLE raw_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id),
    external_id TEXT,
    original_url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    body_text TEXT NOT NULL,
    published_at TIMESTAMP,
    raw_payload JSONB,
    is_processed BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3.3 Clusters
CREATE TABLE clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_article_id UUID NOT NULL REFERENCES raw_articles(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Junction table for cluster membership
CREATE TABLE cluster_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES clusters(id),
    raw_article_id UUID NOT NULL REFERENCES raw_articles(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3.4 Signals
CREATE TABLE signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id UUID NOT NULL REFERENCES clusters(id),
    signal_type signal_type NOT NULL,
    confidence_score INTEGER DEFAULT 0 NOT NULL,
    significance_score INTEGER DEFAULT 0 NOT NULL,
    status signal_status DEFAULT 'pending' NOT NULL,
    ai_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3.5 Briefs
CREATE TABLE briefs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    stories JSONB NOT NULL,
    status TEXT DEFAULT 'draft' NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3.6 Articles
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID REFERENCES signals(id),
    brief_id UUID REFERENCES briefs(id),
    slug TEXT NOT NULL UNIQUE,
    headline TEXT NOT NULL,
    summary TEXT NOT NULL,
    content JSONB,
    excerpt TEXT,
    meta_description TEXT,
    derivative_content JSONB,
    featured_image_url TEXT,
    author TEXT DEFAULT 'CANOPTICON' NOT NULL,
    reading_time INTEGER,
    topics TEXT[],
    entities TEXT[],
    is_draft BOOLEAN DEFAULT true NOT NULL,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3.7 Video Materials
CREATE TABLE video_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id),
    script_60s TEXT,
    key_quotes JSONB,
    angles TEXT[],
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3.8 Logs
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component TEXT NOT NULL,
    run_id UUID,
    level TEXT DEFAULT 'info' NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- AI Usage Tracking
CREATE TABLE ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID REFERENCES signals(id),
    model TEXT NOT NULL,
    prompt_name TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_usd TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Operators Table
CREATE TABLE operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    last_login_at TIMESTAMP
);

-- Subscribers Table
CREATE TABLE subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    status subscriber_status DEFAULT 'pending' NOT NULL,
    source TEXT,
    confirmation_token TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    confirmed_at TIMESTAMP
);

-- System Settings
CREATE TABLE system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    is_encrypted BOOLEAN DEFAULT false NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- PHASE 2 TABLES (Secondary Engine)
-- ============================================================================

-- Secondary Sources
CREATE TABLE secondary_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    base_url TEXT NOT NULL,
    reliability_score INTEGER DEFAULT 0,
    bias_lean TEXT,
    scraper_config JSONB,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Secondary Articles
CREATE TABLE secondary_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    secondary_source_id UUID REFERENCES secondary_sources(id),
    original_url TEXT NOT NULL UNIQUE,
    title TEXT,
    author TEXT,
    content TEXT NOT NULL,
    published_at TIMESTAMP,
    metadata JSONB,
    sentiment_score INTEGER,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Analysis Reports
CREATE TABLE analysis_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_article_id UUID NOT NULL REFERENCES articles(id),
    status signal_status DEFAULT 'pending' NOT NULL,
    fallacies_detected JSONB,
    bias_analysis TEXT,
    contradictions JSONB,
    sources_used JSONB,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Social Accounts
CREATE TABLE social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    handle TEXT NOT NULL,
    instance_url TEXT,
    credentials JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Uploaded Videos
CREATE TABLE uploaded_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_raw_articles_source_id ON raw_articles(source_id);
CREATE INDEX idx_raw_articles_is_processed ON raw_articles(is_processed);
CREATE INDEX idx_raw_articles_original_url ON raw_articles(original_url);

CREATE INDEX idx_clusters_primary_article_id ON clusters(primary_article_id);

CREATE INDEX idx_cluster_articles_cluster_id ON cluster_articles(cluster_id);
CREATE INDEX idx_cluster_articles_article_id ON cluster_articles(raw_article_id);

CREATE INDEX idx_signals_cluster_id ON signals(cluster_id);
CREATE INDEX idx_signals_status ON signals(status);
CREATE INDEX idx_signals_created_at ON signals(created_at);

CREATE INDEX idx_articles_signal_id ON articles(signal_id);
CREATE INDEX idx_articles_brief_id ON articles(brief_id);
CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_is_draft ON articles(is_draft);
CREATE INDEX idx_articles_published_at ON articles(published_at);

CREATE INDEX idx_ai_usage_signal_id ON ai_usage(signal_id);
CREATE INDEX idx_ai_usage_created_at ON ai_usage(created_at);

CREATE INDEX idx_logs_component ON logs(component);
CREATE INDEX idx_logs_run_id ON logs(run_id);
CREATE INDEX idx_logs_created_at ON logs(created_at);

CREATE INDEX idx_secondary_articles_source_id ON secondary_articles(secondary_source_id);
CREATE INDEX idx_analysis_reports_target_article_id ON analysis_reports(target_article_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Database setup complete!' AS status;
