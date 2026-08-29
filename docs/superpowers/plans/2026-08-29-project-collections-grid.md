# 프로젝트/컬렉션 그리드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기록 작성 시 프로젝트 제목과 컬렉션을 지정할 수 있게 하고, 내 경험 목록을 프로젝트별/월별/컬렉션별로 그룹핑된 반응형 카드 그리드로 보여주며, 네비게이션을 화면 상단 고정으로 바꾼다.

**Architecture:** `entries`에 `project_title`(자유 텍스트, 선택)과 `collection_id`(사용자별 `collections` 테이블 FK, 기록당 최대 1개)를 추가한다. 그룹핑 판단 로직은 `src/lib/entryGrouping.ts` 순수 함수로 분리해 테스트한다. 컬렉션은 기록 작성 시(RecordPage)와 사후에 목록에서 여러 개를 골라(EntriesPage 선택 모드) 둘 다 지정 가능하다.

**Tech Stack:** Vite + React + TypeScript, Supabase(Postgres + anon key + RLS), vitest, Tailwind CSS(유틸리티 클래스만).

## Global Constraints

- 프론트는 자기 Supabase 세션(anon key + RLS)으로 직접 읽고 쓴다. service role key는 쓰지 않는다.
- `project_title`은 선택사항, 자유 텍스트(자동완성 제공). 프로젝트 자체를 별도 엔티티로 관리하지 않는다.
- 기록은 컬렉션에 최대 1개만 속한다 (`entries.collection_id` 단일 FK, N:M 아님).
- 그룹 기준이 프로젝트별/컬렉션별일 때 미지정 기록은 항상 "미분류" 섹션으로 모으고, 그 섹션은 그룹 기준과 무관하게 항상 맨 마지막에 온다. 그 외 섹션은 그룹 내 가장 최근 기록 기준 내림차순(월별은 최신 월부터).
- 카드에는 프로젝트 제목(없으면 "제목 없음") / 상황 요약(구조화된 `situation`, 없으면 원문 일부로 대체) / 날짜만 표시하고, 모든 카드는 같은 높이이며 텍스트 초과 시 말줄임(`line-clamp`) 처리한다. 태그 등 다른 정보는 카드에 넣지 않는다.
- 기존 태그+키워드 검색(`filterEntries`)은 그대로 유지하고 그룹핑과 함께(AND로) 적용한다.
- 반응형 그리드: 모바일 2열, 태블릿(`sm`) 3열, 데스크톱(`lg`) 4열.
- 컬렉션 이름 수정/삭제 UI는 만들지 않는다 (생성 + 기록 추가만).

---

### Task 1: DB 스키마 — `collections` 테이블 + `entries` 컬럼 추가, 타입 갱신

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: 없음
- Produces: DB 테이블 `collections`, `entries.project_title`/`entries.collection_id` 컬럼 — Task 3, 4, 5가 이 컬럼들에 의존. `Entry.project_title`, `Entry.collection_id`, `Collection` 타입 — Task 3, 4, 5에서 import.

- [ ] **Step 1: `schema.sql`의 `entries` 테이블 정의 바로 아래에 `collections` 테이블과 `entries` 컬럼 추가**

`supabase/schema.sql`에서:

```sql
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
```

를 아래로 바꾼다(두 테이블 정의 사이에 `collections` 테이블 + `entries` 컬럼 추가를 끼워 넣는다):

```sql
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
alter table entries add column if not exists project_title text;
alter table entries add column if not exists collection_id uuid references collections(id) on delete set null;

-- LLM 구조화 결과 (entry 1:1)
```

- [ ] **Step 2: RLS 섹션에 `collections` 추가**

```sql
alter table entries enable row level security;
alter table entries_structured enable row level security;
```

를 아래로 바꾼다:

```sql
alter table entries enable row level security;
alter table collections enable row level security;
alter table entries_structured enable row level security;
```

그리고 `create policy "entries_owner" ...` 블록 바로 다음에 추가:

```sql
create policy "collections_owner" on collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 3: 이미 배포된 Supabase 프로젝트에 마이그레이션 직접 적용 (수동, 자동화 불가)**

Supabase 대시보드 → SQL Editor에서 아래를 직접 실행한다:

```sql
create table if not exists collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
alter table collections enable row level security;
create policy "collections_owner" on collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table entries add column if not exists project_title text;
alter table entries add column if not exists collection_id uuid references collections(id) on delete set null;
```

이 단계는 테스트로 검증할 수 없다 — 실행 후 Supabase 테이블 목록에 `collections`가 보이고 `entries` 컬럼 목록에 `project_title`/`collection_id`가 보이는지 직접 확인한다. (다음 태스크들은 이 스키마가 실제 DB에 존재해야 동작한다.)

- [ ] **Step 4: `src/types/index.ts`에 타입 추가**

```ts
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
```

(`Entry`에 `project_title`, `collection_id` 두 필드 추가, `Collection` 인터페이스 신규 추가)

- [ ] **Step 5: 빌드로 타입 정합성 확인**

Run: `npm run build`
Expected: 타입 에러 없이 통과

- [ ] **Step 6: 커밋**

```bash
git add supabase/schema.sql src/types/index.ts
git commit -m "feat: add collections table and project_title/collection_id to entries schema"
```

---

### Task 2: `entryGrouping.ts` 순수 함수 작성 (TDD)

**Files:**
- Create: `src/lib/entryGrouping.ts`
- Test: `src/lib/entryGrouping.test.ts`

**Interfaces:**
- Consumes: 없음 (독립적인 순수 함수)
- Produces: `groupEntries<T>(entries: T[], groupBy: GroupBy, collections: CollectionLookup[]): EntryGroup<T>[]`, `type GroupBy = 'project' | 'month' | 'collection'` — Task 4에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/entryGrouping.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { groupEntries } from './entryGrouping';

interface Row {
  id: string;
  created_at: string;
  project_title: string | null;
  collection_id: string | null;
}

const collections = [
  { id: 'c1', name: '취준 소재' },
  { id: 'c2', name: '3학년 1학기' },
];

// EntriesPage 쿼리와 동일하게 이미 created_at 내림차순으로 정렬된 상태를 가정한다.
const entries: Row[] = [
  { id: '1', created_at: '2026-08-20T00:00:00Z', project_title: 'ECHO', collection_id: 'c1' },
  { id: '2', created_at: '2026-08-10T00:00:00Z', project_title: 'ECHO', collection_id: null },
  { id: '3', created_at: '2026-07-15T00:00:00Z', project_title: null, collection_id: 'c2' },
  { id: '4', created_at: '2026-07-01T00:00:00Z', project_title: null, collection_id: null },
];

describe('groupEntries', () => {
  test('groups by month, newest month first', () => {
    const groups = groupEntries(entries, 'month', collections);
    expect(groups.map((g) => g.label)).toEqual(['2026년 8월', '2026년 7월']);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['1', '2']);
    expect(groups[1].entries.map((e) => e.id)).toEqual(['3', '4']);
  });

  test('groups by project, unassigned goes to 미분류 and stays last', () => {
    const groups = groupEntries(entries, 'project', collections);
    expect(groups.map((g) => g.label)).toEqual(['ECHO', '미분류']);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['1', '2']);
    expect(groups[1].entries.map((e) => e.id)).toEqual(['3', '4']);
  });

  test('groups by collection using name lookup, unassigned falls to 미분류', () => {
    const groups = groupEntries(entries, 'collection', collections);
    expect(groups.map((g) => g.label)).toEqual(['취준 소재', '3학년 1학기', '미분류']);
  });

  test('미분류 stays last even if its most recent entry is newest', () => {
    const withRecentUnassigned: Row[] = [
      { id: 'a', created_at: '2026-08-25T00:00:00Z', project_title: null, collection_id: null },
      { id: 'b', created_at: '2026-08-01T00:00:00Z', project_title: 'ECHO', collection_id: null },
    ];
    const groups = groupEntries(withRecentUnassigned, 'project', collections);
    expect(groups.map((g) => g.label)).toEqual(['ECHO', '미분류']);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/lib/entryGrouping.test.ts`
Expected: FAIL — `Cannot find module './entryGrouping'`

- [ ] **Step 3: 최소 구현 작성**

`src/lib/entryGrouping.ts`:

```ts
export type GroupBy = 'project' | 'month' | 'collection';

export interface GroupableEntry {
  id: string;
  created_at: string;
  project_title: string | null;
  collection_id: string | null;
}

export interface CollectionLookup {
  id: string;
  name: string;
}

export interface EntryGroup<T> {
  key: string;
  label: string;
  entries: T[];
}

const UNASSIGNED_KEY = 'unassigned';
const UNASSIGNED_LABEL = '미분류';

function monthKeyAndLabel(isoDate: string): { key: string; label: string } {
  const d = new Date(isoDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return { key: `${year}-${String(month).padStart(2, '0')}`, label: `${year}년 ${month}월` };
}

// entries는 이미 created_at 내림차순으로 정렬돼 들어온다고 가정한다(EntriesPage 쿼리와 동일한 정렬).
// 그룹 내부 순서는 재정렬하지 않고 입력 순서를 그대로 유지한다.
export function groupEntries<T extends GroupableEntry>(
  entries: T[],
  groupBy: GroupBy,
  collections: CollectionLookup[],
): EntryGroup<T>[] {
  const buckets = new Map<string, EntryGroup<T>>();

  for (const entry of entries) {
    let key: string;
    let label: string;

    if (groupBy === 'month') {
      const m = monthKeyAndLabel(entry.created_at);
      key = m.key;
      label = m.label;
    } else if (groupBy === 'project') {
      const title = entry.project_title?.trim();
      key = title ? `project:${title}` : UNASSIGNED_KEY;
      label = title || UNASSIGNED_LABEL;
    } else {
      const found = entry.collection_id ? collections.find((c) => c.id === entry.collection_id) : undefined;
      key = found ? `collection:${found.id}` : UNASSIGNED_KEY;
      label = found ? found.name : UNASSIGNED_LABEL;
    }

    const existing = buckets.get(key);
    if (existing) {
      existing.entries.push(entry);
    } else {
      buckets.set(key, { key, label, entries: [entry] });
    }
  }

  const groups = Array.from(buckets.values());

  if (groupBy === 'month') {
    return groups.sort((a, b) => (a.key < b.key ? 1 : -1));
  }

  return groups.sort((a, b) => {
    if (a.key === UNASSIGNED_KEY) return 1;
    if (b.key === UNASSIGNED_KEY) return -1;
    const aMostRecent = a.entries[0]?.created_at ?? '';
    const bMostRecent = b.entries[0]?.created_at ?? '';
    return aMostRecent < bMostRecent ? 1 : -1;
  });
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/lib/entryGrouping.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/entryGrouping.ts src/lib/entryGrouping.test.ts
git commit -m "feat: add groupEntries for project/month/collection grouping"
```

---

### Task 3: `RecordPage` — 프로젝트 제목 + 컬렉션 입력

**Files:**
- Modify: `src/pages/RecordPage.tsx`

**Interfaces:**
- Consumes: `Collection` 타입 참고용(직접 import는 안 함, 로컬 `CollectionOption` 사용). `entries.project_title`/`collection_id`, `collections` 테이블(Task 1).
- Produces: 없음 (입력 화면)

- [ ] **Step 1: 파일 전체를 아래로 교체**

`src/pages/RecordPage.tsx` 전체를 아래로 교체한다:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useSpeechInput } from '../lib/useSpeechInput';
import { canSubmitRecord } from '../lib/recordValidation';
import type { ExperienceTag } from '../types';

interface StructureResponse {
  situation: string | null;
  role: string | null;
  conflict: string | null;
  action: string | null;
  result: string | null;
  emotion: string | null;
  emotion_reason: string | null;
  realization: string | null;
  tags: ExperienceTag[];
}

interface CollectionOption {
  id: string;
  name: string;
}

const NEW_COLLECTION_VALUE = '__new__';

export function RecordPage() {
  const navigate = useNavigate();
  const speech = useSpeechInput();
  const [text, setText] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [projectTitleOptions, setProjectTitleOptions] = useState<string[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [collectionChoice, setCollectionChoice] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveText = text || speech.transcript;

  useEffect(() => {
    (async () => {
      const [{ data: entryRows }, { data: collectionRows }] = await Promise.all([
        supabase.from('entries').select('project_title').not('project_title', 'is', null),
        supabase.from('collections').select('id, name').order('created_at', { ascending: false }),
      ]);
      const titles = Array.from(
        new Set((entryRows ?? []).map((row) => row.project_title as string).filter(Boolean)),
      );
      setProjectTitleOptions(titles);
      setCollections((collectionRows ?? []) as CollectionOption[]);
    })();
  }, []);

  async function resolveCollectionId(userId: string): Promise<string | null> {
    if (collectionChoice === NEW_COLLECTION_VALUE) {
      const trimmedName = newCollectionName.trim();
      if (!trimmedName) return null;
      const { data: created, error: createError } = await supabase
        .from('collections')
        .insert({ user_id: userId, name: trimmedName })
        .select()
        .single();
      if (createError) throw createError;
      return created.id;
    }
    return collectionChoice || null;
  }

  async function handleSubmit() {
    if (!canSubmitRecord(effectiveText)) return;
    setSaving(true);
    setError(null);
    setStatusMessage('저장 중...');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const collectionId = await resolveCollectionId(user.id);

      const { data: entry, error: insertError } = await supabase
        .from('entries')
        .insert({
          user_id: user.id,
          raw_text: effectiveText,
          input_type: speech.transcript && !text ? 'voice' : 'text',
          project_title: projectTitle.trim() || null,
          collection_id: collectionId,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      setStatusMessage('AI가 구조화하는 중...');

      const res = await fetch('/api/structure', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw_text: effectiveText }),
      });
      if (!res.ok) throw new Error('구조화 요청에 실패했습니다.');
      const structured: StructureResponse = await res.json();

      const { error: structuredError } = await supabase.from('entries_structured').insert({
        entry_id: entry.id,
        situation: structured.situation,
        role: structured.role,
        conflict: structured.conflict,
        action: structured.action,
        result: structured.result,
        emotion: structured.emotion,
        emotion_reason: structured.emotion_reason,
        realization: structured.realization,
        status: 'done',
      });
      if (structuredError) throw structuredError;

      if (structured.tags?.length) {
        const { error: tagError } = await supabase
          .from('entry_tags')
          .insert(structured.tags.map((tag) => ({ entry_id: entry.id, tag })));
        if (tagError) throw tagError;
      }

      setStatusMessage(null);
      navigate(`/entries/${entry.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
      setStatusMessage(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h2 className="text-xl font-semibold text-slate-900">오늘의 경험을 남겨보세요</h2>

      {speech.isSupported && (
        <button
          type="button"
          onClick={speech.isRecording ? speech.stop : speech.start}
          disabled={saving}
          className={`mt-4 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            speech.isRecording
              ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
              : 'border-slate-300 text-slate-600 hover:bg-slate-100'
          }`}
        >
          {speech.isRecording ? '녹음 중지' : '🎙️ 음성으로 기록'}
        </button>
      )}

      <textarea
        placeholder="예: 오늘 팀 발표에서 갑자기 자료가 안 열려서 당황했는데, 즉석에서 화면 공유 없이 설명해서 넘겼다. 발표 끝나고 뿌듯했다."
        value={effectiveText}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        disabled={saving}
        className="mt-4 w-full rounded-md border border-slate-300 p-3 text-sm focus:border-slate-500 focus:outline-none disabled:opacity-50"
      />

      <input
        type="text"
        list="project-title-options"
        placeholder="프로젝트 제목 (선택)"
        value={projectTitle}
        onChange={(e) => setProjectTitle(e.target.value)}
        disabled={saving}
        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:opacity-50"
      />
      <datalist id="project-title-options">
        {projectTitleOptions.map((title) => (
          <option key={title} value={title} />
        ))}
      </datalist>

      <select
        value={collectionChoice}
        onChange={(e) => setCollectionChoice(e.target.value)}
        disabled={saving}
        className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:opacity-50"
      >
        <option value="">컬렉션 없음</option>
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={NEW_COLLECTION_VALUE}>+ 새 컬렉션 만들기</option>
      </select>

      {collectionChoice === NEW_COLLECTION_VALUE && (
        <input
          type="text"
          placeholder="새 컬렉션 이름"
          value={newCollectionName}
          onChange={(e) => setNewCollectionName(e.target.value)}
          disabled={saving}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none disabled:opacity-50"
        />
      )}

      {speech.error && <p className="mt-2 text-sm text-red-600">{speech.error}</p>}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {statusMessage && <p className="mt-2 text-sm text-slate-500">{statusMessage}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving || !canSubmitRecord(effectiveText)}
        className="mt-4 w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
      >
        기록하기
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 빌드로 확인**

Run: `npm run build`
Expected: 타입 에러 없이 통과

- [ ] **Step 3: 커밋**

```bash
git add src/pages/RecordPage.tsx
git commit -m "feat: add project title and collection input to record page"
```

---

### Task 4: `EntriesPage` — 그룹핑/그리드 렌더링

**Files:**
- Modify: `src/pages/EntriesPage.tsx`

**Interfaces:**
- Consumes: `groupEntries`, `type GroupBy` (from `../lib/entryGrouping`, Task 2), `entries.project_title`/`collection_id`/`collections` 테이블(Task 1)
- Produces: 없음 (화면). Task 5가 이 파일에 선택 모드를 추가로 얹는다.

- [ ] **Step 1: 파일 전체를 아래로 교체**

`src/pages/EntriesPage.tsx` 전체를 아래로 교체한다:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { filterEntries } from '../lib/entryFilter';
import { groupEntries, type GroupBy } from '../lib/entryGrouping';
import { TAG_COLORS, TAG_COLORS_ACTIVE } from '../lib/tagColors';
import type { ExperienceTag } from '../types';

const ALL_TAGS: ExperienceTag[] = ['협업', '갈등', '주도성', '실패', '성취', '문제해결'];

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'month', label: '월별' },
  { value: 'project', label: '프로젝트별' },
  { value: 'collection', label: '컬렉션별' },
];

interface EntryRow {
  id: string;
  raw_text: string;
  created_at: string;
  project_title: string | null;
  collection_id: string | null;
  situation: string | null;
  tags: ExperienceTag[];
}

interface CollectionOption {
  id: string;
  name: string;
}

export function EntriesPage() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<ExperienceTag | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: entryRows }, { data: tagRows }, { data: structuredRows }, { data: collectionRows }] =
        await Promise.all([
          supabase
            .from('entries')
            .select('id, raw_text, created_at, project_title, collection_id')
            .order('created_at', { ascending: false }),
          supabase.from('entry_tags').select('entry_id, tag'),
          supabase.from('entries_structured').select('entry_id, situation'),
          supabase.from('collections').select('id, name').order('created_at', { ascending: false }),
        ]);

      const tagsByEntry = new Map<string, ExperienceTag[]>();
      (tagRows ?? []).forEach((row) => {
        const list = tagsByEntry.get(row.entry_id) ?? [];
        list.push(row.tag as ExperienceTag);
        tagsByEntry.set(row.entry_id, list);
      });

      const situationByEntry = new Map<string, string | null>();
      (structuredRows ?? []).forEach((row) => {
        situationByEntry.set(row.entry_id, row.situation);
      });

      setEntries(
        (entryRows ?? []).map((e) => ({
          ...e,
          situation: situationByEntry.get(e.id) ?? null,
          tags: tagsByEntry.get(e.id) ?? [],
        })),
      );
      setCollections((collectionRows ?? []) as CollectionOption[]);
      setLoading(false);
    })();
  }, []);

  // MVP 검색: 태그 필터 + 키워드 매칭. 추후 임베딩 기반 유사도 검색으로 고도화 예정 (CLAUDE.md 참고)
  const filtered = filterEntries(entries, activeTag, query);
  const groups = groupEntries(filtered, groupBy, collections);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h2 className="text-xl font-semibold text-slate-900">내 경험 기록</h2>

      <input
        type="text"
        placeholder="키워드로 검색 (예: 갈등)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={activeTag === tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeTag === tag ? TAG_COLORS_ACTIVE[tag] : TAG_COLORS[tag]
            }`}
          >
            #{tag}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-1.5">
        {GROUP_BY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={groupBy === opt.value}
            onClick={() => setGroupBy(opt.value)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              groupBy === opt.value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && <p className="mt-4 text-sm text-slate-500">불러오는 중...</p>}
      {!loading && filtered.length === 0 && <p className="mt-4 text-sm text-slate-500">기록이 없습니다.</p>}

      {groups.map((group) => (
        <section key={group.key} className="mt-5">
          <h3 className="text-sm font-semibold text-slate-700">{group.label}</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {group.entries.map((entry) => (
              <Link
                key={entry.id}
                to={`/entries/${entry.id}`}
                className="flex h-36 flex-col justify-between rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
              >
                <div>
                  <p className="text-xs font-medium text-slate-500">{entry.project_title || '제목 없음'}</p>
                  <p className="mt-1 line-clamp-3 text-sm text-slate-800">{entry.situation ?? entry.raw_text}</p>
                </div>
                <p className="text-xs text-slate-400">{new Date(entry.created_at).toLocaleDateString('ko-KR')}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 빌드로 확인**

Run: `npm run build`
Expected: 타입 에러 없이 통과

- [ ] **Step 3: 커밋**

```bash
git add src/pages/EntriesPage.tsx
git commit -m "feat: group entries page into project/month/collection card grid"
```

---

### Task 5: `EntriesPage` — 선택 모드 + 컬렉션 일괄 추가

**Files:**
- Modify: `src/pages/EntriesPage.tsx`

**Interfaces:**
- Consumes: Task 4가 만든 `EntriesPage.tsx`의 현재 상태 전체
- Produces: 없음 (화면)

- [ ] **Step 1: 파일 전체를 아래로 교체 (Task 4 내용에 선택 모드 추가)**

`src/pages/EntriesPage.tsx` 전체를 아래로 교체한다:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { filterEntries } from '../lib/entryFilter';
import { groupEntries, type GroupBy } from '../lib/entryGrouping';
import { TAG_COLORS, TAG_COLORS_ACTIVE } from '../lib/tagColors';
import type { ExperienceTag } from '../types';

const ALL_TAGS: ExperienceTag[] = ['협업', '갈등', '주도성', '실패', '성취', '문제해결'];

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'month', label: '월별' },
  { value: 'project', label: '프로젝트별' },
  { value: 'collection', label: '컬렉션별' },
];

const NEW_COLLECTION_VALUE = '__new__';

interface EntryRow {
  id: string;
  raw_text: string;
  created_at: string;
  project_title: string | null;
  collection_id: string | null;
  situation: string | null;
  tags: ExperienceTag[];
}

interface CollectionOption {
  id: string;
  name: string;
}

export function EntriesPage() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<ExperienceTag | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('month');
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCollectionChoice, setBulkCollectionChoice] = useState('');
  const [newBulkCollectionName, setNewBulkCollectionName] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadEntries() {
    setLoading(true);
    const [{ data: entryRows }, { data: tagRows }, { data: structuredRows }, { data: collectionRows }] =
      await Promise.all([
        supabase
          .from('entries')
          .select('id, raw_text, created_at, project_title, collection_id')
          .order('created_at', { ascending: false }),
        supabase.from('entry_tags').select('entry_id, tag'),
        supabase.from('entries_structured').select('entry_id, situation'),
        supabase.from('collections').select('id, name').order('created_at', { ascending: false }),
      ]);

    const tagsByEntry = new Map<string, ExperienceTag[]>();
    (tagRows ?? []).forEach((row) => {
      const list = tagsByEntry.get(row.entry_id) ?? [];
      list.push(row.tag as ExperienceTag);
      tagsByEntry.set(row.entry_id, list);
    });

    const situationByEntry = new Map<string, string | null>();
    (structuredRows ?? []).forEach((row) => {
      situationByEntry.set(row.entry_id, row.situation);
    });

    setEntries(
      (entryRows ?? []).map((e) => ({
        ...e,
        situation: situationByEntry.get(e.id) ?? null,
        tags: tagsByEntry.get(e.id) ?? [],
      })),
    );
    setCollections((collectionRows ?? []) as CollectionOption[]);
    setLoading(false);
  }

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
    setBulkCollectionChoice('');
    setNewBulkCollectionName('');
    setBulkError(null);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleBulkAddToCollection() {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    setBulkError(null);
    try {
      let collectionId = bulkCollectionChoice;

      if (bulkCollectionChoice === NEW_COLLECTION_VALUE) {
        const trimmedName = newBulkCollectionName.trim();
        if (!trimmedName) throw new Error('새 컬렉션 이름을 입력해주세요.');
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('로그인이 필요합니다.');
        const { data: created, error: createError } = await supabase
          .from('collections')
          .insert({ user_id: user.id, name: trimmedName })
          .select()
          .single();
        if (createError) throw createError;
        collectionId = created.id;
        setCollections((prev) => [{ id: created.id, name: created.name }, ...prev]);
      }

      if (!collectionId) throw new Error('컬렉션을 선택해주세요.');

      const { error: updateError } = await supabase
        .from('entries')
        .update({ collection_id: collectionId })
        .in('id', Array.from(selectedIds));
      if (updateError) throw updateError;

      const finalCollectionId = collectionId;
      setEntries((prev) =>
        prev.map((e) => (selectedIds.has(e.id) ? { ...e, collection_id: finalCollectionId } : e)),
      );
      toggleSelectMode();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : '컬렉션에 추가하지 못했습니다.');
    } finally {
      setBulkSaving(false);
    }
  }

  // MVP 검색: 태그 필터 + 키워드 매칭. 추후 임베딩 기반 유사도 검색으로 고도화 예정 (CLAUDE.md 참고)
  const filtered = filterEntries(entries, activeTag, query);
  const groups = groupEntries(filtered, groupBy, collections);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">내 경험 기록</h2>
        <button
          type="button"
          onClick={toggleSelectMode}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          {selectMode ? '선택 취소' : '선택'}
        </button>
      </div>

      <input
        type="text"
        placeholder="키워드로 검색 (예: 갈등)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={activeTag === tag}
            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeTag === tag ? TAG_COLORS_ACTIVE[tag] : TAG_COLORS[tag]
            }`}
          >
            #{tag}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-1.5">
        {GROUP_BY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={groupBy === opt.value}
            onClick={() => setGroupBy(opt.value)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              groupBy === opt.value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && <p className="mt-4 text-sm text-slate-500">불러오는 중...</p>}
      {!loading && filtered.length === 0 && <p className="mt-4 text-sm text-slate-500">기록이 없습니다.</p>}

      {groups.map((group) => (
        <section key={group.key} className="mt-5">
          <h3 className="text-sm font-semibold text-slate-700">{group.label}</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {group.entries.map((entry) => {
              const cardBody = (
                <>
                  <div>
                    <p className="text-xs font-medium text-slate-500">{entry.project_title || '제목 없음'}</p>
                    <p className="mt-1 line-clamp-3 text-sm text-slate-800">{entry.situation ?? entry.raw_text}</p>
                  </div>
                  <p className="text-xs text-slate-400">{new Date(entry.created_at).toLocaleDateString('ko-KR')}</p>
                </>
              );

              if (selectMode) {
                const selected = selectedIds.has(entry.id);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => toggleSelected(entry.id)}
                    className={`relative flex h-36 flex-col justify-between rounded-lg p-3 text-left shadow-sm transition-colors ${
                      selected ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`absolute right-2 top-2 h-4 w-4 rounded-full border-2 ${
                        selected ? 'border-white bg-white' : 'border-slate-300'
                      }`}
                    />
                    {cardBody}
                  </button>
                );
              }

              return (
                <Link
                  key={entry.id}
                  to={`/entries/${entry.id}`}
                  className="flex h-36 flex-col justify-between rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
                >
                  {cardBody}
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 flex flex-col gap-2 border-t border-slate-200 bg-white p-3 shadow-[0_-1px_4px_rgba(0,0,0,0.05)]">
          <p className="text-xs text-slate-500">{selectedIds.size}개 선택됨</p>
          <div className="flex gap-2">
            <select
              value={bulkCollectionChoice}
              onChange={(e) => setBulkCollectionChoice(e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">컬렉션 선택</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_COLLECTION_VALUE}>+ 새 컬렉션 만들기</option>
            </select>
            <button
              type="button"
              onClick={handleBulkAddToCollection}
              disabled={bulkSaving || !bulkCollectionChoice}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              추가
            </button>
          </div>
          {bulkCollectionChoice === NEW_COLLECTION_VALUE && (
            <input
              type="text"
              placeholder="새 컬렉션 이름"
              value={newBulkCollectionName}
              onChange={(e) => setNewBulkCollectionName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          )}
          {bulkError && <p className="text-xs text-red-600">{bulkError}</p>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 빌드로 확인**

Run: `npm run build`
Expected: 타입 에러 없이 통과

- [ ] **Step 3: 커밋**

```bash
git add src/pages/EntriesPage.tsx
git commit -m "feat: add select mode and bulk collection assignment to entries page"
```

---

### Task 6: `App.tsx` — 네비게이션을 화면 상단 고정으로

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (레이아웃)

- [ ] **Step 1: 컴포넌트 순서와 wrapper 클래스 변경**

```tsx
  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <main>
        <Routes>
          <Route path="/" element={<RecordPage />} />
          <Route path="/entries" element={<EntriesPage />} />
          <Route path="/entries/:id" element={<EntryDetailPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <NavBar />
    </div>
  );
```

를 아래로 바꾼다:

```tsx
  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main>
        <Routes>
          <Route path="/" element={<RecordPage />} />
          <Route path="/entries" element={<EntriesPage />} />
          <Route path="/entries/:id" element={<EntryDetailPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
```

- [ ] **Step 2: `nav` 클래스를 하단 고정에서 상단 고정으로 변경**

```tsx
    <nav className="fixed inset-x-0 bottom-0 flex items-center gap-2 border-t border-slate-200 bg-white p-2 shadow-[0_-1px_4px_rgba(0,0,0,0.05)]">
```

를 아래로 바꾼다:

```tsx
    <nav className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white p-2 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
```

- [ ] **Step 3: 빌드로 확인**

Run: `npm run build`
Expected: 타입 에러 없이 통과

- [ ] **Step 4: 커밋**

```bash
git add src/App.tsx
git commit -m "feat: pin navigation bar to top of screen"
```

---

### Task 7: 엔드투엔드 수동 검증

**Files:**
- 없음 (검증만)

**Interfaces:**
- Consumes: Task 1~6의 모든 결과물
- Produces: 없음

- [ ] **Step 1: 전체 테스트 실행**

Run: `npm run test`
Expected: 기존 테스트 + 신규 `entryGrouping` 테스트(4개) 모두 PASS

- [ ] **Step 2: 전체 빌드 실행**

Run: `npm run build`
Expected: 에러 없이 통과

- [ ] **Step 3: 네비게이션 상단 고정 확인**

`npm run dev:vercel`에서 로그인 후, 스크롤해도 네비게이션이 화면 상단에 계속 보이는지 확인.

- [ ] **Step 4: 기록 작성 화면에서 프로젝트/컬렉션 입력 확인**

기록탭에서 프로젝트 제목을 입력(자동완성 뜨는지 확인) + "+ 새 컬렉션 만들기"로 컬렉션을 만들며 저장.

- [ ] **Step 5: 그리드/그룹핑 확인**

내 경험 탭에서 프로젝트별/월별/컬렉션별을 전환하며 섹션 헤더와 카드 그리드 확인. 화면 폭을 좁혀서 2열로, 넓혀서 4열로 바뀌는지 확인. 검색어/태그 필터를 걸고 그룹 기준을 바꿔 필터+그룹이 함께 적용되는지 확인.

- [ ] **Step 6: 선택 모드 + 일괄 컬렉션 추가 확인**

"선택" 버튼으로 선택 모드 진입 → 카드 여러 개 선택 → 기존 컬렉션에 일괄 추가 → 새로고침 후 컬렉션별 그룹에 반영됐는지 확인.

- [ ] **Step 7: 커밋 (필요 시)**

검증 중 발견된 문제를 고쳤다면 해당 수정 사항을 커밋한다. 문제가 없었다면 이 태스크는 커밋 없이 종료한다.
