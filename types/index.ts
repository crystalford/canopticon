export interface Signal {
  id: string; // Hash of URL or content
  hash: string;
  source: string;
  source_id?: string; // UUID from sources table
  headline: string;
  summary: string;
  url: string;
  publishedAt: string;
  confidence_score?: number; // 0-100
  signal_type?: 'breaking' | 'repetition' | 'contradiction' | 'shift' | 'novelty';
  cluster_id?: string;

  // Analysis
  status: 'pending' | 'approved' | 'flagged' | 'rejected' | 'archived' | 'published' | 'processing';
  priority?: 'critical' | 'high' | 'normal' | 'low';
  analysis?: any; // JSONB for full analysis object

  // Entities/Topics
  entities: string[];
  topics: string[];

  // AI Data
  ai_summary?: string;
  ai_script?: string;
  ai_tags?: string[];

  // Original raw data
  raw_content?: any;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  category: 'institutional' | 'news' | 'independent' | 'government';
  source_type: 'rss' | 'api' | 'social';
  priority: number; // 1-10
  reliability_score: number; // 0-1
  active: boolean;
  last_ingested_at?: string;
  consecutive_failures: number;
  auto_disabled: boolean;
  ingestion_frequency_minutes: number;
}

export interface TriageScore {
  score: number;
  reasoning: string;
  recommended_action: 'approve' | 'archive' | 'review' | 'flag';
  confidence_level?: number;
}

export interface Article {
  id: string;
  signal_id: string;
  slug: string;
  headline: string;
  summary: string;
  tier: 'curated' | 'archive';
  published_at: string;
  video_status: 'none' | 'script_ready' | 'in_progress' | 'published';
  sources: string[]; // URLs
}

export interface VideoMaterial {
  script: string;
  quotes: Array<{ text: string; attribution: string; timestamp?: string }>;
  contradictions: Array<{ claim: string; counter: string; evidence: string }>;
  angles: string[];
}

export type PublicationType = 'image' | 'audio' | 'thread' | 'article' | 'infographic' | 'research' | 'video_script';

export interface Publication {
  id: string;
  signal_id: string;
  type: PublicationType;
  content: any;
  created_at: string;
}
