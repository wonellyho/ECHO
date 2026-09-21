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

-- 사용자가 직접 만드는 폴더/컬렉션 (기록은 최대 1개 컬렉션에만 속함)
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- 프로젝트 제목(선택) + 컬렉션 소속
-- project_title은 2026-09-02부로 신규 기록에는 더 이상 쓰지 않는다 — "프로젝트별"과
-- "컬렉션별"이 사실상 같은 묶음 개념으로 쓰이고 있어 컬렉션 하나로 통일했다(옛 기록의
-- project_title 값은 보존해 카드 제목 폴백으로만 계속 쓴다). 컬럼 자체는 하위호환을 위해 남긴다.
alter table entries add column if not exists project_title text;
alter table entries add column if not exists collection_id uuid references collections(id) on delete set null;

-- 카드 배경색 — 저장 시점에 사용자가 5색 팔레트 중 직접 고른다(태그 자동 매핑 대신).
-- 값은 src/lib/tagColors.ts의 CARD_COLOR_KEYS와 정확히 같아야 한다.
alter table entries add column if not exists card_color text
  check (card_color in ('navy', 'rose', 'plum', 'coral', 'slate'));

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
  realization text,
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

-- STARWL 변환 결과 (entry 1:N, 재생성 가능하므로 1:1 강제하지 않음)
create table if not exists starwl_conversions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  situation text,
  task text,
  action text,
  result text,
  why text,
  learning text,
  created_at timestamptz not null default now()
);

-- 패턴(별자리) 탭에서 사용자가 직접 옮긴 별무리(군집) 3D 위치. 군집은 태그 6종 + 태그 없는
-- 기록을 위한 'unassigned', 총 7개마다 최대 1행 — 옮긴 적 없으면 행이 없고, 그러면 프론트가
-- lib/constellation/layout.ts의 기본 CLUSTER_CENTERS를 그대로 쓴다
-- (buildGraph.ts의 applyClusterCenters 참고).
-- 2026-09-21: 군집 기준을 에너지원/소진요인(neutral/energizer/drainer)에서 태그로 바꿨다.
-- 기존에 저장된 neutral/energizer/drainer 행은 새 CLUSTER_CENTERS 키와 맞지 않아 조용히
-- 무시된다(에러는 아니다) — 필요하면 `delete from cluster_positions;`로 정리해도 된다.
-- scale: 편집 모드에서 손잡이로 조절한 별무리 크기 배율(기본 1). 기존 테이블에는
-- `alter table cluster_positions add column if not exists scale double precision not null default 1;`
-- 을 한 번 실행해줘야 한다.
create table if not exists cluster_positions (
  user_id uuid not null references auth.users(id) on delete cascade,
  cluster text not null check (cluster in ('협업', '갈등', '주도성', '실패', '성취', '문제해결', 'unassigned')),
  x double precision not null,
  y double precision not null,
  z double precision not null,
  scale double precision not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, cluster)
);

-- RLS: 각 사용자는 자기 데이터만
alter table entries enable row level security;
alter table collections enable row level security;
alter table entries_structured enable row level security;
alter table entry_tags enable row level security;
alter table insights enable row level security;
alter table starwl_conversions enable row level security;
alter table cluster_positions enable row level security;

create policy "entries_owner" on entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "collections_owner" on collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "entries_structured_owner" on entries_structured
  for all using (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()))
  with check (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()));

create policy "entry_tags_owner" on entry_tags
  for all using (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()))
  with check (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()));

create policy "insights_owner" on insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "starwl_conversions_owner" on starwl_conversions
  for all using (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()))
  with check (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()));

create policy "cluster_positions_owner" on cluster_positions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
