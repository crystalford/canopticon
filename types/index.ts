export type SignalPriority = 'low' | 'medium' | 'high' | 'critical';
export type SignalStatus = 'pending' | 'processing' | 'published' | 'archived';

export interface Signal {
  id: string; // uuid or url hash
  hash: string; // deduplication hash
  headline: string;
  summary?: string;
  url: string;
  source: string; // "CBC", "CTV", "Twitter"
  publishedAt: string;

  // Analysis
  priority: SignalPriority;
  status: SignalStatus;
  entities: string[]; // "Trudeau", "Poilievre"
  topics: string[]; // "Housing", "Inflation"

  // Raw
  rawContent?: string;
}

export interface IntakeLog {
  id: string;
  timestamp: string;
  source: string;
  status: 'success' | 'failed';
  itemsCount: number;
}

export type PublicationType = 'image' | 'audio' | 'thread' | 'article';

export interface Publication {
  id: string;
  signal_hash: string;
  type: PublicationType;
  content: any; // URL string, array of strings, or text block
  created_at: string;
}
