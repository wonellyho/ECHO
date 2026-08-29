export type ExperienceTag = '협업' | '갈등' | '주도성' | '실패' | '성취' | '문제해결';

export interface Entry {
  id: string;
  user_id: string;
  raw_text: string;
  input_type: 'text' | 'voice';
  audio_url: string | null;
  project_title: string | null;
  collection_id: string | null;
  created_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface EntryStructured {
  entry_id: string;
  situation: string | null;
  role: string | null;
  conflict: string | null;
  action: string | null;
  result: string | null;
  emotion: string | null;
  emotion_reason: string | null;
  realization: string | null;
  status: 'pending' | 'done' | 'failed';
}

export interface EntryWithDetails extends Entry {
  structured: EntryStructured | null;
  tags: ExperienceTag[];
}

export interface Insight {
  id: string;
  user_id: string;
  type: 'energizer' | 'drainer';
  summary: string;
  evidence_entry_ids: string[];
  created_at: string;
}

export interface StarConversion {
  id: string;
  entry_id: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  created_at: string;
}
