-- ECHO 데이터베이스 스키마
-- Supabase SQL Editor에서 실행하세요.

create extension if not exists "pgcrypto";

-- 원본 기록
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_text text not null,
  input_type text not null default 'text' check (input_type in ('text', 'voice')),
  audio_url text,
  created_at timestamptz not null default now()
);

-- LLM 구조화 결과 (entry 1:1)
create table if not exists entries_structured (
  entry_id uuid primary key references entries(id) on delete cascade,
  situation text,
  role text,
  conflict text,
  action text,
  result text,
  emotion text,
  emotion_reason text,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  created_at timestamptz not null default now()
);

-- 태그 (entry 1:N)
create table if not exists entry_tags (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  tag text not null check (tag in ('협업', '갈등', '주도성', '실패', '성취', '문제해결')),
  created_at timestamptz not null default now(),
  unique (entry_id, tag)
);

-- 에너지원/소진요인 인사이트 (근거 기록 연결 필수)
create table if not exists insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('energizer', 'drainer')),
  summary text not null,
  evidence_entry_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- STAR 변환 결과 (entry 1:N, 재생성 가능하므로 1:1 강제하지 않음)
create table if not exists star_conversions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  situation text,
  task text,
  action text,
  result text,
  created_at timestamptz not null default now()
);

-- RLS: 각 사용자는 자기 데이터만
alter table entries enable row level security;
alter table entries_structured enable row level security;
alter table entry_tags enable row level security;
alter table insights enable row level security;
alter table star_conversions enable row level security;

create policy "entries_owner" on entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "entries_structured_owner" on entries_structured
  for all using (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()))
  with check (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()));

create policy "entry_tags_owner" on entry_tags
  for all using (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()))
  with check (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()));

create policy "insights_owner" on insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "star_conversions_owner" on star_conversions
  for all using (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()))
  with check (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()));
