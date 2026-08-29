# STARWL 상세 레이아웃 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기록 상세 화면을 좌(원문)/우(구조화·STARWL/패턴 탭) 2단 레이아웃으로 바꾸고, STAR를 Why·Learning까지 포함한 동일 레벨의 STARWL로 확장한다.

**Architecture:** `star_conversions` 테이블/타입/API 라우트를 `starwl_conversions`/`StarWlConversion`/`/api/starwl`로 완전히 리네임하고 `why`, `learning` 컬럼을 추가한다. `api/starwl.ts`의 시스템 프롬프트는 `why`를 역할·갈등·감정 이유에서, `learning`을 기존 `realization`(깨달음) 값에서 도출하도록 지시한다(근거성 원칙 동일 적용). `EntryDetailPage`는 넓은 화면에서 CSS grid로 좌우 분할하고, 좁은 화면에서는 기존처럼 세로로 쌓인다.

**Tech Stack:** Vite + React + TypeScript, Supabase(Postgres + anon key + RLS), Vercel Functions(`api/*.ts`), Tailwind CSS(유틸리티 클래스만).

## Global Constraints

- API 키는 `/api/*` 서버리스 함수에서만 사용하고 프론트로 노출하지 않는다.
- `why`/`learning`은 다른 필드와 동일한 근거성 원칙을 따른다: 근거가 부족하면 null로 남기고 화면엔 `-`로 표시한다.
- `learning`은 구조화 단계의 `realization`이 있으면 그것을 다듬어 쓰고, 없고 근거도 부족하면 null.
- Why/Learning은 STAR와 "동일 레벨"이어야 한다 — DB 테이블명(`starwl_conversions`)과 타입명(`StarWlConversion`)까지 통일하고, 화면에서도 S/T/A/R/W/L 6개를 시각적 구분 없이 하나의 목록으로 표시한다.
- 좌우 분할은 `lg`(데스크톱) 이상에서만 적용하고, 그 아래 화면 폭에서는 기존처럼 원문이 위, 탭이 아래로 세로 배치된다.
- 패턴 탭 자체의 동작(쿼리, 빈 상태 안내 등)은 바꾸지 않는다 — 화면 오른쪽 컬럼으로 위치만 옮긴다.
- Why/Learning은 새로 변환할 때만 채워진다. 기존에 저장된 STAR 결과를 소급 생성(백필)하지 않는다.

---

### Task 1: DB 스키마 — `star_conversions` → `starwl_conversions` 리네임 + `why`/`learning` 컬럼 추가

**Files:**
- Modify: `supabase/schema.sql`

**Interfaces:**
- Consumes: 없음
- Produces: DB 테이블 `starwl_conversions`(`why`, `learning` 컬럼 포함) — Task 2, 3, 4가 이 테이블/컬럼에 의존.

- [ ] **Step 1: `schema.sql`의 `star_conversions` 테이블 정의를 리네임 + 컬럼 추가**

```sql
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
```

를 아래로 바꾼다:

```sql
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
```

- [ ] **Step 2: RLS 섹션의 테이블명/정책명도 함께 변경**

```sql
alter table star_conversions enable row level security;
```

를 아래로 바꾼다:

```sql
alter table starwl_conversions enable row level security;
```

```sql
create policy "star_conversions_owner" on star_conversions
  for all using (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()))
  with check (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()));
```

를 아래로 바꾼다:

```sql
create policy "starwl_conversions_owner" on starwl_conversions
  for all using (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()))
  with check (exists (select 1 from entries e where e.id = entry_id and e.user_id = auth.uid()));
```

- [ ] **Step 3: 이미 배포된 Supabase 프로젝트에 마이그레이션 직접 적용 (수동, 자동화 불가)**

Supabase 대시보드 → SQL Editor에서 아래를 직접 실행한다(기존 데이터 보존됨 — `create table`이 아니라 `rename`/`alter`):

```sql
alter table star_conversions rename to starwl_conversions;
alter table starwl_conversions add column if not exists why text;
alter table starwl_conversions add column if not exists learning text;
alter policy "star_conversions_owner" on starwl_conversions rename to "starwl_conversions_owner";
```

이 단계는 테스트로 검증할 수 없다 — 실행 후 Supabase 테이블 목록에 `starwl_conversions`가 보이고(기존 `star_conversions` 데이터가 그대로 있고) 컬럼 목록에 `why`/`learning`이 보이는지 직접 확인한다. (다음 태스크들은 이 스키마가 실제 DB에 존재해야 동작한다.)

- [ ] **Step 4: 커밋**

```bash
git add supabase/schema.sql
git commit -m "feat: rename star_conversions to starwl_conversions and add why/learning columns"
```

---

### Task 2: `api/star.ts` → `api/starwl.ts` 리네임 + Why/Learning 프롬프트 추가

**Files:**
- Modify (rename): `api/star.ts` → `api/starwl.ts`

**Interfaces:**
- Consumes: `callLlmJson` (from `./_lib/llm.js`, 변경 없음)
- Produces: `POST /api/starwl` — Task 4에서 이 경로로 fetch. 응답 JSON에 `why`, `learning` 키 포함.

- [ ] **Step 1: 파일 이름 변경 (히스토리 보존)**

```bash
git mv api/star.ts api/starwl.ts
```

- [ ] **Step 2: `api/starwl.ts` 내용 전체를 아래로 교체**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callLlmJson } from './_lib/llm.js';

interface StarWlResult {
  situation: string;
  task: string;
  action: string;
  result: string;
  why: string | null;
  learning: string | null;
}

const SYSTEM_PROMPT = `너는 대학생의 구조화된 경험 기록을 STARWL(Situation, Task, Action, Result, Why, Learning) 형식의
면접·자소서 소재로 다듬는 도우미다.

규칙:
- 입력으로 주어진 구조화 데이터에 없는 사실을 지어내지 마라. 문장을 다듬고 연결하는 것은 괜찮지만 새로운 사실을 추가하지 마라.
- situation/task/action/result는 각각 2~4문장 정도로, 면접에서 바로 말할 수 있는 자연스러운 한국어 문장으로 작성하라.
- why는 입력된 역할(role)·갈등(conflict)·감정의 이유(emotion_reason)에 근거해서만, 그 행동을 왜 그렇게 선택했는지 설명하라. 근거가 부족하면 null로 남겨라.
- learning은 입력에 realization(깨달음)이 있으면 그 내용을 자연스러운 문장으로 다듬어 사용하고, 없다면 결과(result)나 감정에서 합리적으로 도출 가능한 범위에서만 작성하라. 그마저 근거가 없으면 null로 남겨라.
- 반드시 아래 JSON 형식으로만 응답하라. JSON 객체 앞뒤에 설명, 추론 과정, 다른 텍스트를 절대 붙이지 마라.

{
  "situation": "...",
  "task": "...",
  "action": "...",
  "result": "...",
  "why": "... 또는 null",
  "learning": "... 또는 null"
}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const structured = req.body as {
      situation?: string | null;
      role?: string | null;
      conflict?: string | null;
      action?: string | null;
      result?: string | null;
      emotion?: string | null;
      emotion_reason?: string | null;
      realization?: string | null;
    };

    const input = JSON.stringify(structured, null, 2);

    const { data: parsed } = await callLlmJson<StarWlResult>({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: input }],
      maxTokens: 800,
    });
    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : '알 수 없는 오류' });
  }
}
```

(입력 타입에 `realization`을 명시적으로 추가한 것과, `StarResult`를 `StarWlResult`로 바꾸고 `why`/`learning`을 추가한 것, 시스템 프롬프트가 STARWL 6개 항목을 요구하는 것이 기존 `api/star.ts`와의 차이)

- [ ] **Step 3: API 타입체크로 확인**

Run: `npm run typecheck:api`
Expected: 에러 없이 통과

- [ ] **Step 4: 커밋**

```bash
git add api/starwl.ts
git commit -m "feat: rename star API to starwl and add why/learning fields to prompt"
```

---

### Task 3: `src/types/index.ts` — `StarConversion` → `StarWlConversion`

**Files:**
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `StarWlConversion` 타입(`why`, `learning` 포함) — Task 4에서 사용.

- [ ] **Step 1: 타입 리네임 + 필드 추가**

```ts
export interface StarConversion {
  id: string;
  entry_id: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  created_at: string;
}
```

를 아래로 바꾼다:

```ts
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
```

- [ ] **Step 2: 빌드로 확인 (아직 `EntryDetailPage.tsx`가 옛 이름을 참조하므로 이 시점엔 에러가 나는 게 정상)**

Run: `npm run build`
Expected: `src/pages/EntryDetailPage.tsx`에서 `StarConversion`을 찾을 수 없다는 타입 에러 — Task 4에서 해소됨. 이 태스크 자체는 여기서 커밋하지 않고 Task 4와 함께 커밋한다.

---

### Task 4: `EntryDetailPage` — 좌우 분할 레이아웃 + STARWL 표시

**Files:**
- Modify: `src/pages/EntryDetailPage.tsx`

**Interfaces:**
- Consumes: `StarWlConversion` (Task 3), `/api/starwl` (Task 2), `starwl_conversions` 테이블(Task 1)
- Produces: 없음 (최종 화면)

- [ ] **Step 1: 파일 전체를 아래로 교체**

`src/pages/EntryDetailPage.tsx` 전체를 아래로 교체한다:

```tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { TAG_COLORS } from '../lib/tagColors';
import type { EntryStructured, ExperienceTag, StarWlConversion } from '../types';

const STRUCTURED_FIELDS: { key: keyof EntryStructured; label: string }[] = [
  { key: 'situation', label: '상황' },
  { key: 'role', label: '내 역할' },
  { key: 'conflict', label: '문제·갈등' },
  { key: 'action', label: '행동' },
  { key: 'result', label: '결과' },
  { key: 'emotion', label: '감정' },
  { key: 'emotion_reason', label: '감정의 이유' },
  { key: 'realization', label: '깨달음' },
];

const STARWL_FIELDS: { key: keyof StarWlConversion; label: string }[] = [
  { key: 'situation', label: 'Situation' },
  { key: 'task', label: 'Task' },
  { key: 'action', label: 'Action' },
  { key: 'result', label: 'Result' },
  { key: 'why', label: 'Why' },
  { key: 'learning', label: 'Learning' },
];

interface RelatedInsight {
  id: string;
  type: 'energizer' | 'drainer';
  summary: string;
  evidence_entry_ids: string[];
}

export function EntryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [rawText, setRawText] = useState('');
  const [structured, setStructured] = useState<EntryStructured | null>(null);
  const [draft, setDraft] = useState<Partial<EntryStructured>>({});
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [tags, setTags] = useState<ExperienceTag[]>([]);
  const [starwl, setStarwl] = useState<StarWlConversion | null>(null);
  const [starwlLoading, setStarwlLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'starwl' | 'pattern'>('starwl');
  const [relatedInsights, setRelatedInsights] = useState<RelatedInsight[]>([]);
  const [patternLoaded, setPatternLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: entry }, { data: struct }, { data: tagRows }, { data: starwlRows }] = await Promise.all([
        supabase.from('entries').select('raw_text').eq('id', id).single(),
        supabase.from('entries_structured').select('*').eq('entry_id', id).maybeSingle(),
        supabase.from('entry_tags').select('tag').eq('entry_id', id),
        supabase
          .from('starwl_conversions')
          .select('*')
          .eq('entry_id', id)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);
      if (entry) setRawText(entry.raw_text);
      if (struct) setStructured(struct as EntryStructured);
      if (tagRows) setTags(tagRows.map((r) => r.tag as ExperienceTag));
      if (starwlRows && starwlRows.length > 0) setStarwl(starwlRows[0] as StarWlConversion);
    })();
  }, [id]);

  useEffect(() => {
    if (!id || tab !== 'pattern' || patternLoaded) return;
    (async () => {
      const { data } = await supabase
        .from('insights')
        .select('id, type, summary, evidence_entry_ids')
        .contains('evidence_entry_ids', [id]);
      setRelatedInsights((data ?? []) as RelatedInsight[]);
      setPatternLoaded(true);
    })();
  }, [id, tab, patternLoaded]);

  function startEdit() {
    if (!structured) return;
    setDraft(structured);
    setEditing(true);
  }

  async function saveEdit() {
    if (!id) return;
    setSavingEdit(true);
    setError(null);
    try {
      const updates = Object.fromEntries(STRUCTURED_FIELDS.map(({ key }) => [key, draft[key] ?? null]));
      const { data, error: updateError } = await supabase
        .from('entries_structured')
        .update(updates)
        .eq('entry_id', id)
        .select()
        .single();
      if (updateError) throw updateError;
      setStructured(data as EntryStructured);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정 저장에 실패했습니다.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleStarwlConvert() {
    if (!structured || !id) return;
    setStarwlLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/starwl', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(structured),
      });
      if (!res.ok) throw new Error('STARWL 변환에 실패했습니다.');
      const result = await res.json();

      const { data, error: insertError } = await supabase
        .from('starwl_conversions')
        .insert({ entry_id: id, ...result })
        .select()
        .single();
      if (insertError) throw insertError;
      setStarwl(data as StarWlConversion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'STARWL 변환에 실패했습니다.');
    } finally {
      setStarwlLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h2 className="text-xl font-semibold text-slate-900">기록 상세</h2>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-lg bg-slate-50 p-4 shadow-sm lg:sticky lg:top-16 lg:self-start">
          <p className="whitespace-pre-wrap text-sm text-slate-800">{rawText}</p>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className={`rounded-full px-2 py-0.5 text-xs font-medium ${TAG_COLORS[tag]}`}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex gap-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setTab('starwl')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                tab === 'starwl' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              구조화/STARWL
            </button>
            <button
              type="button"
              onClick={() => setTab('pattern')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                tab === 'pattern' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              패턴
            </button>
          </div>

          {tab === 'starwl' && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-700">구조화 결과</h3>
                {structured &&
                  (editing ? (
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={savingEdit}
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                    >
                      {savingEdit ? '저장 중...' : '저장'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startEdit}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      수정
                    </button>
                  ))}
              </div>

              {structured ? (
                <dl className="mt-2 space-y-2">
                  {STRUCTURED_FIELDS.map(({ key, label }) => (
                    <div key={key} className="rounded-lg bg-white p-3 shadow-sm">
                      <dt className="text-xs font-medium text-slate-500">{label}</dt>
                      {editing ? (
                        <textarea
                          value={draft[key] ?? ''}
                          onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                          rows={2}
                          className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                        />
                      ) : (
                        <dd className="mt-1 text-sm text-slate-800">{structured[key] ?? '-'}</dd>
                      )}
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 text-sm text-slate-500">구조화 결과를 불러오는 중입니다...</p>
              )}

              <button
                type="button"
                onClick={handleStarwlConvert}
                disabled={starwlLoading || !structured}
                className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
              >
                {starwlLoading ? '변환 중...' : starwl ? 'STARWL로 다시 변환' : 'STARWL로 변환'}
              </button>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

              {starwl && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-slate-700">STARWL</h3>
                  <dl className="mt-2 space-y-2">
                    {STARWL_FIELDS.map(({ key, label }) => (
                      <div key={key} className="rounded-lg bg-white p-3 shadow-sm">
                        <dt className="text-xs font-medium text-slate-500">{label}</dt>
                        <dd className="mt-1 text-sm text-slate-800">{starwl[key] ?? '-'}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}

          {tab === 'pattern' && (
            <div className="mt-4">
              {relatedInsights.length === 0 ? (
                <p className="text-sm text-slate-500">
                  이 기록과 관련된 패턴이 아직 없어요.{' '}
                  <Link to="/insights" className="font-medium text-slate-900 underline">
                    전체 패턴 분석 보러가기
                  </Link>
                </p>
              ) : (
                <ul className="space-y-2">
                  {relatedInsights.map((item) => (
                    <li
                      key={item.id}
                      className={`rounded-lg border-l-4 p-3 shadow-sm ${
                        item.type === 'energizer' ? 'border-amber-400 bg-amber-50' : 'border-slate-400 bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-medium text-slate-500">
                        {item.type === 'energizer' ? '⚡ 에너지를 얻는 조건' : '🔋 소진되는 조건'}
                      </p>
                      <p className="mt-1 text-sm text-slate-800">{item.summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드로 확인**

Run: `npm run build`
Expected: 타입 에러 없이 통과 (Task 3에서 남겨둔 에러까지 함께 해소됨)

- [ ] **Step 3: 커밋 (Task 3의 타입 변경 포함)**

```bash
git add src/types/index.ts src/pages/EntryDetailPage.tsx
git commit -m "feat: split entry detail into two columns and show STARWL fields"
```

---

### Task 5: `CLAUDE.md` 문서 갱신

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (문서만)

- [ ] **Step 1: 폴더 구조 설명에서 `star.ts` 참조 갱신**

```
  star.ts               구조화 데이터 → STAR 변환
```

를 아래로 바꾼다:

```
  starwl.ts             구조화 데이터 → STARWL(Why/Learning 포함) 변환
```

- [ ] **Step 2: 커밋**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for star.ts to starwl.ts rename"
```

---

### Task 6: 엔드투엔드 수동 검증

**Files:**
- 없음 (검증만)

**Interfaces:**
- Consumes: Task 1~5의 모든 결과물
- Produces: 없음

- [ ] **Step 1: 전체 테스트 실행**

Run: `npm run test`
Expected: 기존 테스트 모두 PASS (이번 슬라이스는 새 단위 테스트 대상 없음 — 레이아웃/프롬프트 변경 위주)

- [ ] **Step 2: 전체 빌드 실행**

Run: `npm run build`
Expected: 에러 없이 통과

- [ ] **Step 3: 좌우 분할 레이아웃 확인**

`npm run dev:vercel`에서 기록 상세로 이동 → 브라우저 창을 넓게 해서 좌(원문)/우(탭) 2단 배치 확인 → 창을 좁혀서 세로 배치로 바뀌는지 확인.

- [ ] **Step 4: STARWL 변환 확인**

"STARWL로 변환" 클릭 → Situation/Task/Action/Result/Why/Learning 6개가 같은 카드 목록으로 보이는지 확인.

- [ ] **Step 5: 깨달음(realization) 반영 확인**

깨달음을 입력해둔 기록으로 변환해서 Learning이 그 내용을 반영하는지 확인. 깨달음 없이 근거도 부족한 기록으로 변환해서 Why/Learning이 `-`로 뜨는지 확인.

- [ ] **Step 6: 기존 STAR 데이터 하위 호환 확인**

리네임 이전에 이미 저장돼 있던 STAR 결과(있다면)를 다시 열어 에러 없이 보이는지, Why/Learning이 `-`로 뜨는지 확인.

- [ ] **Step 7: 커밋 (필요 시)**

검증 중 발견된 문제를 고쳤다면 해당 수정 사항을 커밋한다. 문제가 없었다면 이 태스크는 커밋 없이 종료한다.
