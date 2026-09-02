export type ExperienceTag = '협업' | '갈등' | '주도성' | '실패' | '성취' | '문제해결';

// 카드 배경색 5종 (저장 시 사용자가 팔레트에서 직접 고름). DB CHECK 제약과 동일해야 한다.
export type CardColorKey = 'navy' | 'rose' | 'plum' | 'coral' | 'slate';

export interface Entry {
  id: string;
  user_id: string;
  raw_text: string;
  input_type: 'text' | 'voice';
  audio_url: string | null;
  // 2026-09-02부로 신규 기록엔 쓰지 않음 — 옛 기록의 카드 제목 폴백 용도로만 남아있음 (design.md 참고).
  project_title: string | null;
  collection_id: string | null;
  card_color: CardColorKey | null;
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

export interface StarWlConversion {
  id: string;
  entry_id: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  why: string | null;
  learning: string | null;
  created_at: string;
}
