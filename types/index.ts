export interface Signal {
  id: string;
  slug: string;
  title: string;
  source: string;
  timestamp: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'processing' | 'resolved' | 'archived';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface IntakeLog {
  id: string;
  timestamp: string;
  source: string;
  signalId: string;
  action: string;
  status: 'success' | 'failed' | 'pending';
  details?: string;
}
