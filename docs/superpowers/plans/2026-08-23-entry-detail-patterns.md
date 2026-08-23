# 기록 상세 STAR/패턴 탭 + 깨달음 필드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기록 상세 화면에 "구조화/STAR" 탭과 "패턴" 탭을 만들고, 구조화 결과에 "깨달음" 필드를 추가하며, 인사이트(에너지원/소진요인)를 DB에 저장해 상세 탭에서 근거 기록별로 조회할 수 있게 한다.

**Architecture:** 기존 `entries_structured` 테이블에 `realization` 컬럼을 추가하고 `api/structure.ts` 프롬프트/스키마를 확장한다. `insights` 테이블(이미 존재하나 지금까지 한 번도 쓰이지 않음)에 인사이트를 실제로 저장하도록 `InsightsPage`를 고치고("다시 분석하기" 클릭 시에만 삭제 후 재삽입), `EntryDetailPage`는 저장된 인사이트를 `evidence_entry_ids`로 조회해 탭으로 보여준다. `InsightsPage`를 처음으로 네비게이션/라우트에 연결한다. 이번 슬라이스가 건드리는 화면(EntryDetailPage, InsightsPage, NavBar)에만 가벼운 Tailwind 스타일을 입힌다.

**Tech Stack:** Vite + React + TypeScript, Supabase(Postgres + anon key + RLS), Vercel Functions(`api/*.ts`), vitest, Tailwind CSS(유틸리티 클래스만).

## Global Constraints

- API 키(ANTHROPIC_API_KEY, OPENROUTER_API_KEY)는 `/api/*` 서버리스 함수에서만 사용하고 프론트로 노출하지 않는다.
- 프론트는 자기 Supabase 세션(anon key + RLS)으로 직접 읽고 쓴다. service role key는 쓰지 않는다.
- LLM이 반환하는 구조화/인사이트 값은 기록에 명시적으로 드러나지 않으면 임의로 추측·단정하지 않고 null로 남긴다(근거성 원칙). realization 필드도 동일 규칙을 따른다.
- 태그는 `협업/갈등/주도성/실패/성취/문제해결` 6종 고정(DB CHECK 제약). 이번 슬라이스에서 태그 관련 로직은 건드리지 않는다.
- 인사이트 항목은 반드시 근거 `entry_id`(`evidence_entry_ids`)와 함께 저장한다.
- 이번 슬라이스가 건드리는 화면(EntryDetailPage, InsightsPage, NavBar)에만 Tailwind 유틸리티 클래스로 가벼운 스타일(색상·그림자·간단한 전환 애니메이션)을 입힌다. RecordPage/EntriesPage/LoginPage는 손대지 않는다. 다크모드·반응형 세밀 조정·커스텀 폰트는 하지 않는다.
- 인사이트 재생성(삭제 후 재삽입)은 "다시 분석하기" 버튼을 눌렀을 때만 일어난다. 화면 진입 시 자동으로 재생성하지 않는다.

---

### Task 1: 임시 진단 로그 제거

> **실행 시점 참고:** 이 태스크가 대상으로 하던 진단 로그(`[llm][diag]`, `[structure][diag]`)는 커밋된 적 없는
> 로컬 미커밋 변경사항이었고, 실행 전 정리 과정에서 이미 버려졌다(`git checkout -- api/_lib/llm.ts api/structure.ts`).
> 즉 `api/_lib/llm.ts`, `api/structure.ts` 현재 커밋 상태에 진단 로그가 없다. 이 태스크는 완료된 것으로 간주하고
> 구현 서브에이전트를 붙이지 않는다 — 아래 단계는 기록용으로만 남긴다.

**Files:**
- Modify: `api/_lib/llm.ts`
- Modify: `api/structure.ts`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (순수 정리 작업)

- [ ] **Step 1: `api/_lib/llm.ts`에서 임시 진단 로그 제거**

`callLlmJson` 안의 아래 두 블록을 제거한다(주석 포함):

```ts
      // TEMP DIAGNOSTIC (2026-08-23): remove after root-causing empty/failed structuring.
      // eslint-disable-next-line no-console
      console.log('[llm][diag] openrouter raw (first 500 chars):', raw.slice(0, 500));
```

와

```ts
  // TEMP DIAGNOSTIC (2026-08-23): remove after root-causing empty/failed structuring.
  // eslint-disable-next-line no-console
  console.log('[llm][diag] anthropic raw (first 500 chars):', raw.slice(0, 500));
```

제거 후 각 자리에는 바로 다음 줄(`return { data: extractJson<T>(raw), ... }`)만 남는다.

- [ ] **Step 2: `api/structure.ts`에서 임시 진단 로그 제거**

아래 블록을 제거한다:

```ts
    // TEMP DIAGNOSTIC (2026-08-23): remove after confirming request payload reaches the LLM intact.
    // eslint-disable-next-line no-console
    console.log('[structure][diag] req.body typeof:', typeof req.body, 'raw_text:', JSON.stringify(raw_text));
```

- [ ] **Step 3: 타입체크로 확인**

Run: `npm run typecheck:api`
Expected: 에러 없이 통과

- [ ] **Step 4: 커밋**

```bash
git add api/_lib/llm.ts api/structure.ts
git commit -m "chore: remove temporary diagnostic logging from LLM call path"
```

---

### Task 2: DB 마이그레이션 — `entries_structured`에 `realization` 컬럼 추가

**Files:**
- Modify: `supabase/schema.sql`

**Interfaces:**
- Consumes: 없음
- Produces: `entries_structured.realization` 컬럼(text, nullable) — Task 3, 6, 7에서 사용

- [ ] **Step 1: `schema.sql`의 `entries_structured` 정의에 컬럼 추가**

`supabase/schema.sql`에서:

```sql
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
```

를 아래로 바꾼다(emotion_reason 다음 줄에 realization 추가):

```sql
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
```

- [ ] **Step 2: 이미 배포된 Supabase 프로젝트에 마이그레이션 직접 적용 (수동, 자동화 불가)**

Supabase 대시보드 → SQL Editor에서 아래를 직접 실행한다(이미 테이블이 있으므로 `create table`이 아니라 `alter table`을 써야 함):

```sql
alter table entries_structured add column if not exists realization text;
```

이 단계는 테스트로 검증할 수 없다 — Supabase SQL Editor에서 실행 후 `entries_structured` 테이블 컬럼 목록에 `realization`이 보이는지 직접 확인한다. (다음 태스크들은 이 컬럼이 실제 DB에 존재해야 동작한다.)

- [ ] **Step 3: 커밋**

```bash
git add supabase/schema.sql
git commit -m "feat: add realization column to entries_structured schema"
```

---

### Task 3: `realization` 필드를 구조화 API/타입/기록 저장 경로에 추가

**Files:**
- Modify: `src/types/index.ts`
- Modify: `api/structure.ts`
- Modify: `src/pages/RecordPage.tsx`

**Interfaces:**
- Consumes: Task 2의 `entries_structured.realization` 컬럼
- Produces: `EntryStructured.realization: string | null` (Task 7에서 사용), `api/structure.ts`가 반환하는 JSON에 `realization` 키 포함

- [ ] **Step 1: `src/types/index.ts`의 `EntryStructured`에 필드 추가**

```ts
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
```

- [ ] **Step 2: `api/structure.ts`의 `StructureResult`와 시스템 프롬프트에 추가**

```ts
interface StructureResult {
  situation: string | null;
  role: string | null;
  conflict: string | null;
  action: string | null;
  result: string | null;
  emotion: string | null;
  emotion_reason: string | null;
  realization: string | null;
  tags: string[];
}
```

`SYSTEM_PROMPT`의 JSON 스키마 블록을:

```ts
{
  "situation": "어떤 상황이었는지",
  "role": "본인의 역할",
  "conflict": "문제나 갈등이 있었다면 무엇인지 (없으면 null)",
  "action": "실제로 한 행동",
  "result": "결과",
  "emotion": "느낀 감정",
  "emotion_reason": "그 감정을 느낀 이유",
  "tags": ["태그1", "태그2"]
}
```

에서 아래로 바꾼다:

```ts
{
  "situation": "어떤 상황이었는지",
  "role": "본인의 역할",
  "conflict": "문제나 갈등이 있었다면 무엇인지 (없으면 null)",
  "action": "실제로 한 행동",
  "result": "결과",
  "emotion": "느낀 감정",
  "emotion_reason": "그 감정을 느낀 이유",
  "realization": "이 경험에서 깨달은 점이나 배운 점 (기록에 명시적으로 드러나지 않으면 null)",
  "tags": ["태그1", "태그2"]
}
```

- [ ] **Step 3: `src/pages/RecordPage.tsx`의 `StructureResponse` 타입과 insert 호출에 추가**

`StructureResponse` 인터페이스:

```ts
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
```

`entries_structured` insert 호출:

```ts
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
```

- [ ] **Step 4: 빌드로 타입 정합성 확인**

Run: `npm run build`
Expected: 타입 에러 없이 통과

- [ ] **Step 5: 커밋**

```bash
git add src/types/index.ts api/structure.ts src/pages/RecordPage.tsx
git commit -m "feat: add realization field through structure API and record insert"
```

---

### Task 4: `buildInsightRows` 순수 함수 작성 (TDD)

**Files:**
- Create: `src/lib/buildInsightRows.ts`
- Test: `src/lib/buildInsightRows.test.ts`

**Interfaces:**
- Consumes: 없음 (독립적인 순수 함수)
- Produces: `buildInsightRows(result: InsightApiResult, userId: string): InsightInsertRow[]` — Task 5(`InsightsPage`)에서 사용. `InsightApiResult`와 `InsightInsertRow`는 이 파일에서 export한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/buildInsightRows.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { buildInsightRows } from './buildInsightRows';

describe('buildInsightRows', () => {
  test('maps energizers and drainers into typed insert rows with user_id', () => {
    const result = {
      energizers: [{ summary: '팀원과 함께 문제를 풀 때 에너지를 얻음', evidence_entry_ids: ['e1', 'e2'] }],
      drainers: [{ summary: '역할이 불명확할 때 소진됨', evidence_entry_ids: ['e3'] }],
    };

    const rows = buildInsightRows(result, 'user-123');

    expect(rows).toEqual([
      {
        user_id: 'user-123',
        type: 'energizer',
        summary: '팀원과 함께 문제를 풀 때 에너지를 얻음',
        evidence_entry_ids: ['e1', 'e2'],
      },
      {
        user_id: 'user-123',
        type: 'drainer',
        summary: '역할이 불명확할 때 소진됨',
        evidence_entry_ids: ['e3'],
      },
    ]);
  });

  test('returns empty array when there are no energizers or drainers', () => {
    const rows = buildInsightRows({ energizers: [], drainers: [] }, 'user-123');
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npx vitest run src/lib/buildInsightRows.test.ts`
Expected: FAIL — `Cannot find module './buildInsightRows'`

- [ ] **Step 3: 최소 구현 작성**

`src/lib/buildInsightRows.ts`:

```ts
export interface InsightItem {
  summary: string;
  evidence_entry_ids: string[];
}

export interface InsightApiResult {
  energizers: InsightItem[];
  drainers: InsightItem[];
}

export interface InsightInsertRow {
  user_id: string;
  type: 'energizer' | 'drainer';
  summary: string;
  evidence_entry_ids: string[];
}

export function buildInsightRows(result: InsightApiResult, userId: string): InsightInsertRow[] {
  const energizerRows: InsightInsertRow[] = result.energizers.map((item) => ({
    user_id: userId,
    type: 'energizer',
    summary: item.summary,
    evidence_entry_ids: item.evidence_entry_ids,
  }));
  const drainerRows: InsightInsertRow[] = result.drainers.map((item) => ({
    user_id: userId,
    type: 'drainer',
    summary: item.summary,
    evidence_entry_ids: item.evidence_entry_ids,
  }));
  return [...energizerRows, ...drainerRows];
}
```

- [ ] **Step 4: 테스트 실행해서 통과 확인**

Run: `npx vitest run src/lib/buildInsightRows.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/buildInsightRows.ts src/lib/buildInsightRows.test.ts
git commit -m "feat: add buildInsightRows for mapping LLM insight results to DB rows"
```

---

### Task 5: `InsightsPage` — 인사이트를 DB에 저장하고, 진입 시엔 저장된 것만 조회

**Files:**
- Modify: `src/pages/InsightsPage.tsx`

**Interfaces:**
- Consumes: `buildInsightRows(result, userId)`, `InsightInsertRow` (from `../lib/buildInsightRows`)
- Produces: `insights` 테이블에 실제로 저장된 row들(`id, user_id, type, summary, evidence_entry_ids, created_at`) — Task 7의 EntryDetailPage 패턴 탭이 이 테이블을 조회한다.

- [ ] **Step 1: 저장된 인사이트를 불러오는 함수와, 재생성 함수를 분리해서 새로 작성**

`src/pages/InsightsPage.tsx` 전체를 아래로 교체한다:

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { buildInsightRows } from '../lib/buildInsightRows';

interface InsightRow {
  id: string;
  type: 'energizer' | 'drainer';
  summary: string;
  evidence_entry_ids: string[];
}

const MIN_ENTRIES_FOR_INSIGHTS = 3;

export function InsightsPage() {
  const [energizers, setEnergizers] = useState<InsightRow[]>([]);
  const [drainers, setDrainers] = useState<InsightRow[]>([]);
  const [entryCount, setEntryCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStoredInsights() {
    setLoading(true);
    setError(null);
    try {
      const [{ data: structuredRows }, { data: insightRows, error: insightError }] = await Promise.all([
        supabase.from('entries_structured').select('entry_id').eq('status', 'done'),
        supabase
          .from('insights')
          .select('id, type, summary, evidence_entry_ids')
          .order('created_at', { ascending: false }),
      ]);
      if (insightError) throw insightError;

      setEntryCount(structuredRows?.length ?? 0);
      const rows = (insightRows ?? []) as InsightRow[];
      setEnergizers(rows.filter((r) => r.type === 'energizer'));
      setDrainers(rows.filter((r) => r.type === 'drainer'));
    } catch (err) {
      setError(err instanceof Error ? err.message : '인사이트를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인이 필요합니다.');

      const { data: structuredRows, error: fetchError } = await supabase
        .from('entries_structured')
        .select('entry_id, situation, role, action, result, emotion, emotion_reason')
        .eq('status', 'done');
      if (fetchError) throw fetchError;

      setEntryCount(structuredRows?.length ?? 0);
      if (!structuredRows || structuredRows.length < MIN_ENTRIES_FOR_INSIGHTS) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entries: structuredRows }),
      });
      if (!res.ok) throw new Error('인사이트 생성에 실패했습니다.');
      const result = await res.json();

      const { error: deleteError } = await supabase.from('insights').delete().eq('user_id', user.id);
      if (deleteError) throw deleteError;

      const rowsToInsert = buildInsightRows(result, user.id);
      const { data: insertedRows, error: insertError } = await supabase
        .from('insights')
        .insert(rowsToInsert)
        .select('id, type, summary, evidence_entry_ids');
      if (insertError) throw insertError;

      const rows = (insertedRows ?? []) as InsightRow[];
      setEnergizers(rows.filter((r) => r.type === 'energizer'));
      setDrainers(rows.filter((r) => r.type === 'drainer'));
    } catch (err) {
      setError(err instanceof Error ? err.message : '인사이트 재생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStoredInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h2 className="text-xl font-semibold text-slate-900">나의 에너지 패턴</h2>

      {entryCount < MIN_ENTRIES_FOR_INSIGHTS && (
        <p className="mt-2 text-sm text-slate-500">
          기록이 {MIN_ENTRIES_FOR_INSIGHTS}개 이상 쌓이면 패턴을 분석해드려요. (현재 {entryCount}개)
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {loading && <p className="mt-2 text-sm text-slate-500">분석 중...</p>}

      {energizers.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-medium text-slate-700">⚡ 에너지를 얻는 조건</h3>
          <ul className="mt-2 space-y-2">
            {energizers.map((item) => (
              <li key={item.id} className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 shadow-sm">
                <p className="text-sm text-slate-800">{item.summary}</p>
                <p className="mt-1 text-xs text-slate-500">근거 기록 {item.evidence_entry_ids.length}건</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {drainers.length > 0 && (
        <section className="mt-6">
          <h3 className="text-sm font-medium text-slate-700">🔋 소진되는 조건</h3>
          <ul className="mt-2 space-y-2">
            {drainers.map((item) => (
              <li key={item.id} className="rounded-lg border-l-4 border-slate-400 bg-slate-50 p-3 shadow-sm">
                <p className="text-sm text-slate-800">{item.summary}</p>
                <p className="mt-1 text-xs text-slate-500">근거 기록 {item.evidence_entry_ids.length}건</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={regenerate}
        disabled={loading}
        className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
      >
        다시 분석하기
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크로 확인**

Run: `npm run build`
Expected: 타입 에러 없이 통과

- [ ] **Step 3: 커밋**

```bash
git add src/pages/InsightsPage.tsx
git commit -m "feat: persist insights to DB, regenerate only on button click"
```

---

### Task 6: `/insights` 라우트 연결 + 네비게이션 "패턴" 링크

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `InsightsPage` (from `./pages/InsightsPage`)
- Produces: `/insights` 라우트 — Task 7에서 빈 상태 안내 링크가 여기로 이동한다.

- [ ] **Step 1: `InsightsPage` import 및 라우트 추가**

`src/App.tsx` 상단 import에 추가:

```ts
import { InsightsPage } from './pages/InsightsPage';
```

`<Routes>` 안에 추가:

```tsx
<Route path="/insights" element={<InsightsPage />} />
```

(`/` , `/entries`, `/entries/:id` 라우트 사이 아무 곳이나, `*` catch-all보다는 위에 위치)

- [ ] **Step 2: `NavBar`에 링크 추가 + 가벼운 스타일**

`NavBar` 함수를 아래로 바꾼다:

```tsx
function NavBar() {
  const location = useLocation();

  const linkClass = (active: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <nav className="flex items-center gap-2 border-t border-slate-200 bg-white p-2">
      <Link to="/" className={linkClass(location.pathname === '/')}>
        기록
      </Link>
      <Link to="/entries" className={linkClass(location.pathname.startsWith('/entries'))}>
        내 경험
      </Link>
      <Link to="/insights" className={linkClass(location.pathname === '/insights')}>
        패턴
      </Link>
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="ml-auto rounded-md px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
      >
        로그아웃
      </button>
    </nav>
  );
}
```

- [ ] **Step 3: 빌드로 확인**

Run: `npm run build`
Expected: 타입 에러 없이 통과

- [ ] **Step 4: 커밋**

```bash
git add src/App.tsx
git commit -m "feat: wire /insights route and add 패턴 nav link"
```

---

### Task 7: `EntryDetailPage` — 깨달음 필드 + 구조화/STAR·패턴 탭 + 가벼운 스타일

**Files:**
- Modify: `src/pages/EntryDetailPage.tsx`

**Interfaces:**
- Consumes: `EntryStructured.realization` (Task 3), `insights` 테이블(Task 5가 실제로 채움), `TAG_COLORS` (from `../lib/tagColors`)
- Produces: 없음 (최종 화면)

- [ ] **Step 1: 상단 import와 필드 목록에 깨달음 추가**

`STRUCTURED_FIELDS` 배열에 `emotion_reason` 다음 항목으로 추가:

```ts
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
```

- [ ] **Step 2: import 추가 및 패턴 탭용 상태/타입 추가**

파일 상단 import에 추가:

```ts
import { Link } from 'react-router-dom';
import { TAG_COLORS } from '../lib/tagColors';
```

(`useParams`는 이미 `react-router-dom`에서 import 중이므로 같은 import 문에 `Link`를 합친다: `import { useParams, Link } from 'react-router-dom';`)

컴포넌트 안, 기존 `useState` 선언들 옆에 추가:

```ts
interface RelatedInsight {
  id: string;
  type: 'energizer' | 'drainer';
  summary: string;
  evidence_entry_ids: string[];
}

const [tab, setTab] = useState<'star' | 'pattern'>('star');
const [relatedInsights, setRelatedInsights] = useState<RelatedInsight[]>([]);
const [patternLoaded, setPatternLoaded] = useState(false);
```

- [ ] **Step 3: 패턴 탭 데이터 로딩 함수 추가**

기존 `useEffect`(초기 데이터 로딩) 아래에 새 `useEffect`를 추가한다:

```ts
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
```

- [ ] **Step 4: 탭 UI와 두 탭의 내용을 렌더링하도록 return 블록 교체**

`return (...)` 전체를 아래로 교체한다:

```tsx
return (
  <div className="mx-auto max-w-2xl px-4 py-6">
    <h2 className="text-xl font-semibold text-slate-900">기록 상세</h2>

    <div className="mt-4 rounded-lg bg-slate-50 p-4 shadow-sm">
      <p className="text-sm text-slate-800">{rawText}</p>
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

    <div className="mt-4 flex gap-2 border-b border-slate-200">
      <button
        type="button"
        onClick={() => setTab('star')}
        className={`px-3 py-2 text-sm font-medium transition-colors ${
          tab === 'star' ? 'border-b-2 border-slate-900 text-slate-900' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        구조화/STAR
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

    {tab === 'star' && (
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
          onClick={handleStarConvert}
          disabled={starLoading || !structured}
          className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          {starLoading ? '변환 중...' : star ? 'STAR로 다시 변환' : 'STAR로 변환'}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {star && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-slate-700">STAR</h3>
            <dl className="mt-2 space-y-2">
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <dt className="text-xs font-medium text-slate-500">Situation</dt>
                <dd className="mt-1 text-sm text-slate-800">{star.situation}</dd>
              </div>
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <dt className="text-xs font-medium text-slate-500">Task</dt>
                <dd className="mt-1 text-sm text-slate-800">{star.task}</dd>
              </div>
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <dt className="text-xs font-medium text-slate-500">Action</dt>
                <dd className="mt-1 text-sm text-slate-800">{star.action}</dd>
              </div>
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <dt className="text-xs font-medium text-slate-500">Result</dt>
                <dd className="mt-1 text-sm text-slate-800">{star.result}</dd>
              </div>
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
);
```

- [ ] **Step 5: 빌드로 확인**

Run: `npm run build`
Expected: 타입 에러 없이 통과

- [ ] **Step 6: 커밋**

```bash
git add src/pages/EntryDetailPage.tsx
git commit -m "feat: add realization field and 구조화/STAR·패턴 tabs to entry detail"
```

---

### Task 8: 엔드투엔드 수동 검증

**Files:**
- 없음 (검증만)

**Interfaces:**
- Consumes: Task 1~7의 모든 결과물
- Produces: 없음

- [ ] **Step 1: 전체 테스트 실행**

Run: `npm run test`
Expected: 기존 테스트(`recordValidation`, `entryFilter`) + 신규 `buildInsightRows` 테스트 모두 PASS

- [ ] **Step 2: 전체 빌드 실행**

Run: `npm run build`
Expected: 에러 없이 통과

- [ ] **Step 3: 로컬 또는 배포 환경에서 새 기록 작성 후 깨달음 필드 확인**

`npm run dev`(또는 배포 URL)로 접속 → 로그인 → 새 기록 작성 → 상세 페이지의 "구조화/STAR" 탭에서 "깨달음" 필드가 보이는지 확인(내용이 없으면 `-`).

- [ ] **Step 4: 네비게이션 "패턴" 진입 및 인사이트 생성 확인**

네비게이션 "패턴" 클릭 → `/insights` 진입. 기록이 3개 미만이면 안내 문구만 보이는지 확인. 3개 이상이면 "다시 분석하기" 클릭 → energizer/drainer 카드가 뜨는지 확인 → 새로고침해도 결과가 남아있는지 확인(DB 저장 확인).

- [ ] **Step 5: 기록 상세의 패턴 탭 확인**

방금 생성된 인사이트에 근거로 포함된 기록 하나를 상세에서 열어 "패턴" 탭 클릭 → 관련 카드만 보이는지 확인. 근거로 포함되지 않은 다른 기록의 "패턴" 탭에서는 "관련 패턴 없음 + 전체 패턴 분석 보러가기" 안내가 보이는지 확인.

- [ ] **Step 6: 커밋 (필요 시)**

검증 중 발견된 문제를 고쳤다면 해당 수정 사항을 커밋한다. 문제가 없었다면 이 태스크는 커밋 없이 종료한다.
