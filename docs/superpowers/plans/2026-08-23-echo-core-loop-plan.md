# ECHO 핵심 루프 프론트엔드 재작성 — 실행 플랜

## Context

배포는 이미 연결돼 있지만 배포된 URL에서 핵심 기능이 끝까지 동작하는 걸 확인한 적이 없다.
현재 화면(로그인/기록/목록/상세)은 초기 스캐폴딩 수준의 UI라 오늘 다시 만든다. 승인된 설계는
`docs/superpowers/specs/2026-08-23-echo-core-loop-design.md`에 있고, 이 플랜은 그 스펙을
Tailwind CSS 기반으로 실행하기 위한 구체적 작업 목록이다.

목표(오늘 성공 기준): 배포된 URL에서 **로그인 → 기록 작성(텍스트/음성) → 저장+AI 구조화 →
목록/상세 확인(+수정) → STAR 변환**이 처음부터 끝까지 끊김 없이 동작한다.

## 확인된 현재 상태 (재사용)

- API(`api/structure.ts`, `api/star.ts`, `api/_lib/llm.ts`)와 `supabase/schema.sql`은 그대로 둔다 — 변경 없음.
- `src/lib/supabaseClient.ts`, `src/lib/useAuth.ts`(세션 관리), `src/lib/useSpeechInput.ts`(Web Speech API 래퍼), `src/types/index.ts`는 로직 변경 없이 그대로 재사용.
- 인증 방식은 `supabase.auth.signInWithPassword({ email, password })` (기존 `LoginPage.tsx` 패턴) — 재사용.
- Tailwind는 이 repo에 전혀 설치/설정되어 있지 않음(확인 완료). `vite.config.ts`는 `@vitejs/plugin-react` 하나만 쓰는 표준 ESM 구성.
- 패키지 매니저는 npm (package-lock.json만 존재).

## 작업 목록

### 1. Tailwind CSS 도입
- devDependency 추가: `tailwindcss`, `@tailwindcss/vite` (npm install -D).
- `vite.config.ts`에 `import tailwindcss from '@tailwindcss/vite'`를 추가하고 `plugins: [react(), tailwindcss()]`로 수정.
- `src/index.css`를 Tailwind v4 방식(`@import "tailwindcss";`)으로 전면 교체 — 기존 `:root` 커스텀 테마 변수/다크모드 블록은 제거(플레인 CSS 잔재 정리).
- `src/App.css`는 삭제하고 `src/App.tsx`의 `import './App.css'`도 제거. 기존에 이 파일이 정의하던 클래스(`.app-shell`, `.nav-bar`, `.tag`, `.entry-list`, `.structured`, `.error`, `.status` 등)는 각 컴포넌트에서 Tailwind 유틸리티 클래스로 인라인 대체.

### 2. 공통: 태그 색상 매핑
- 새 파일 `src/lib/tagColors.ts` 생성: `ExperienceTag → Tailwind 클래스 문자열` 고정 매핑(협업=blue, 갈등=red, 주도성=amber, 실패=slate, 성취=green, 문제해결=violet 계열의 `bg-*-100 text-*-700` 조합). `EntriesPage`, `EntryDetailPage`에서 공통으로 import해서 태그 칩 색상에 사용.

### 3. `src/App.tsx` 재작성
- 라우팅 구조(로그인 게이트, `/`, `/entries`, `/entries/:id`, 나머지 `Navigate`)는 그대로 유지하되 **`/insights` 라우트와 `InsightsPage` import를 제거** (파일 자체는 삭제하지 않음).
- `NavBar`와 최상위 레이아웃을 Tailwind로 재작성: 하단 고정 탭바(기록/내 경험 두 탭 + 로그아웃 버튼), 모바일 1열 최대폭 컨테이너.
- 로딩 상태(`불러오는 중...`)도 Tailwind로 중앙 정렬.

### 4. `src/pages/LoginPage.tsx` 재작성
- 회원가입 모드 토글/`supabase.auth.signUp` 분기 제거 — **로그인 전용** 폼만 남긴다(`signInWithPassword` 호출 로직은 기존 그대로 유지).
- Tailwind로 카드형 중앙 정렬 로그인 폼(이메일/비밀번호 입력, 에러 메시지, 로딩 중 버튼 비활성화)으로 재작성.

### 5. `src/pages/RecordPage.tsx` 재작성
- 기존 로직(제출 시 `entries` insert → `/api/structure` fetch → `entries_structured` insert → `entry_tags` insert → `navigate` to detail) 그대로 유지, UI만 Tailwind로 교체.
- `useSpeechInput` 훅 재사용해 🎙️ 버튼 유지, 텍스트/음성 병합 입력 로직(`effectiveText`) 그대로.
- 상태 메시지(저장 중/구조화 중)와 에러를 Tailwind 배너 스타일로 표시.

### 6. `src/pages/EntriesPage.tsx` 재작성
- 기존 조회/클라이언트 필터링 로직(태그 필터 + 키워드 매칭, `entries`+`entry_tags` 병렬 조회) 그대로 유지.
- 카드형 리스트로 재작성: 각 카드에 원문 일부, 날짜, 색상 태그 칩(`tagColors.ts` 사용). 태그 필터 버튼도 동일 색상 매핑 적용.

### 7. `src/pages/EntryDetailPage.tsx` 재작성 (기능 추가 포함)
- 기존 조회 로직(entries/entries_structured/entry_tags 병렬 조회) 유지.
- **신규**: 구조화 결과 7개 텍스트 필드(situation/role/conflict/action/result/emotion/emotion_reason)를 "수정" 버튼으로 편집 모드 전환 → 각 필드 `<textarea>`로 바뀌고 "저장" 시 `supabase.from('entries_structured').update({...}).eq('entry_id', id)` 호출. 태그는 읽기 전용(편집 UI 없음).
- STAR 변환: 기존 `/api/star` 호출 + `star_conversions` insert 로직 유지하되, **페이지 로드 시 `star_conversions`를 `entry_id` 조건 + `order('created_at', { ascending: false }).limit(1)`로 조회**해서 이미 변환된 게 있으면 새로고침 후에도 최신본을 보여준다. 재변환 버튼을 누르면 새로 insert하고 화면의 최신본을 갱신.
- Tailwind로 카드 레이아웃(원문 카드, 구조화 필드 카드, STAR 카드) 재작성.

### 8. 배포 확인 (코드 외)
- `vercel:env` 스킬/CLI로 Vercel 프로덕션 환경변수(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, 선택 `OPENROUTER_MODEL`)가 설정되어 있는지 확인하고 없으면 추가.
- Supabase 테이블은 이미 존재 확인됨 — 추가 작업 없음.

## 검증

1. `npm run build` (`tsc -b && vite build`)로 타입 오류/빌드 오류 없는지 확인.
2. `npm run dev`로 로컬에서 전체 흐름(로그인 → 기록 작성(텍스트) → 목록에서 확인 → 상세에서 필드 수정+저장 → STAR 변환) 수동 확인.
3. 음성 입력 버튼으로 문장 인식 → 텍스트란 반영 확인(지원 브라우저에서).
4. Vercel에 배포(`vercel:deploy` 또는 git push로 자동 배포) 후 프로덕션 URL에서 2번 흐름을 동일하게 재확인 — 이게 오늘의 최종 성공 기준.
5. 새로고침 후 STAR 변환 결과와 수정한 구조화 필드가 유지되는지 확인(DB 반영 여부 검증).
