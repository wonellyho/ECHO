# ECHO 핵심 루프 프론트엔드 재작성 — 설계

- 작성일: 2026-08-23
- 관련 문서: `PRD_ECHO.md`, `CLAUDE.md`

## 배경

GitHub 저장소와 Vercel 배포는 이미 연결되어 있지만, 배포된 URL에서 핵심 기능이 처음부터
끝까지 동작하는 걸 아직 확인한 적이 없다. 현재 프론트엔드 화면(로그인/기록/목록/상세/인사이트)은
초기 스캐폴딩 단계에서 만들어진 것으로, UI가 투박하고 오늘 목표에 맞춰 다시 설계할 필요가 있다.

오늘의 성공 기준은 하나다: **배포된 URL에서 핵심 기능 하나가 처음부터 끝까지 동작한다.**
그 핵심 기능은 "기록 작성 → 목록/상세 확인 → STAR 변환"이다.

## 범위

### 포함
- 로그인(이미 있는 테스트 계정으로 로그인만, 회원가입 없음)
- 기록 작성: 텍스트 + 음성(Web Speech API) 입력
- 저장 시 AI 구조화(`/api/structure`) 자동 호출 및 저장
- 기록 목록: 카드형 리스트, 태그 필터 + 키워드 검색(클라이언트 사이드)
- 기록 상세: 구조화 결과 조회 + 텍스트 필드 직접 수정
- STAR 변환(`/api/star`): 상세 화면에서 변환 실행, 재변환 시 새로 추가하고 최신본만 표시
- Tailwind CSS 기반 카드형 모바일 우선 디자인

### 제외 (오늘 범위 아님)
- 인사이트(에너지원/소진 요인) 화면 — 라우팅에서 제외, 파일은 보존
- 질문/키워드 기반 검색의 고도화(자연어 질문 검색) — 기존 단순 필터만 유지
- 회원가입 플로우
- 태그 수동 추가/삭제 (AI 결과 그대로 사용)

## 아키텍처

### 유지 (변경 없음)
- `/api/structure.ts`, `/api/star.ts`, `/api/_lib/llm.ts` — OpenRouter 무료 모델 우선 + Claude Haiku
  폴백, JSON 파싱 안정화까지 이미 반영됨.
- `supabase/schema.sql` — 이미 배포된 Supabase 프로젝트에 테이블 생성 완료.
- `src/lib/supabaseClient.ts`, `src/lib/useAuth.ts`, `src/lib/useSpeechInput.ts`, `src/types/index.ts`.

### 신규 작성
- `src/pages/LoginPage.tsx`, `src/pages/RecordPage.tsx`, `src/pages/EntriesPage.tsx`,
  `src/pages/EntryDetailPage.tsx` — Tailwind 클래스 기반으로 재작성.
- `src/App.tsx` — 라우팅 구조는 동일하게 유지하되 `/insights` 라우트 제거, 레이아웃/네비게이션
  스타일을 Tailwind로 교체.
- Tailwind 설정: `tailwind.config.js`, `postcss.config.js`, `src/index.css`(`@tailwind` 지시어)
  추가. `App.css`는 제거하거나 비움.

### 보존만 (사용 안 함)
- `src/pages/InsightsPage.tsx` — 라우팅에서 제외하지만 삭제하지 않음(추후 재사용).

## 데이터 흐름

1. **기록 작성**: `entries` insert → `/api/structure` 호출 → `entries_structured` insert
   (status: `done`) → `entry_tags` insert(허용된 6개 태그만) → 상세 페이지로 이동.
   이 흐름은 기존 `RecordPage.tsx`의 로직을 그대로 옮기고 UI만 Tailwind로 교체한다.
2. **목록 조회**: `entries` + `entry_tags` 조회 후 클라이언트에서 태그 필터/키워드 매칭
   (기존 `EntriesPage.tsx` 로직 유지).
3. **상세 조회/수정**: `entries`, `entries_structured`, `entry_tags`를 병렬 조회. "수정" 버튼을
   누르면 7개 텍스트 필드가 입력 가능한 상태로 바뀌고, "저장"을 누르면 `entries_structured`
   테이블을 `update`한다(RLS로 소유자만 허용).
4. **STAR 변환**: 상세 화면의 구조화 데이터를 `/api/star`로 전송 → 응답을 `star_conversions`에
   insert → 이번 세션에서 방금 만든 결과를 최신본으로 표시. (페이지를 새로고침해도 최신 1건을
   `created_at desc limit 1`로 조회해서 보여준다.)

모든 근거성 원칙(CLAUDE.md 데이터 흐름 원칙)은 그대로 유지: 구조화/STAR 결과는 항상 원본
`entry_id`와 연결된 채로 저장되고, 클라이언트는 자기 Supabase 세션으로 직접 읽고 쓴다.

## UI/디자인

- **스타일링**: Tailwind CSS 도입(`tailwindcss`, `postcss`, `autoprefixer`를 devDependency로
  추가, Vite 플러그인 설정). 기존 `App.css` 대체.
- **레이아웃**: 모바일 우선 1열, 카드형 컴포넌트(둥근 모서리, 그림자 약하게).
- **태그 색상**: 6개 고정 태그(`협업/갈등/주도성/실패/성취/문제해결`) 각각에 고정 Tailwind
  색상 팔레트를 매핑(예: 협업=blue, 갈등=red, 주도성=amber, 실패=slate, 성취=green,
  문제해결=violet)해 목록/상세 화면에서 동일하게 사용.
- **네비게이션**: 하단 고정 탭바(기록/내 경험, 인사이트 탭은 숨김) 형태 유지.

## 에러/로딩 처리

기존 패턴을 유지한다: 각 비동기 동작(저장, 구조화, STAR 변환, 목록 로딩)마다 로딩 상태 텍스트와
실패 시 인라인 에러 메시지를 표시한다. 토스트/모달 등 추가 UI 패턴은 도입하지 않는다.

## 배포 관련 (코드 외 작업)

- Vercel 프로덕션 환경변수(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`(선택), `ANTHROPIC_API_KEY`)가 실제로 설정되어
  있는지 확인하고, 없으면 오늘 안에 추가한다.
- Supabase 테이블은 이미 생성되어 있으므로 추가 작업 없음.

## 검증 방법

1. 배포된 프로덕션 URL에 접속해 테스트 계정으로 로그인.
2. 텍스트로 짧은 경험을 기록하고 제출 → 구조화 완료 후 상세 페이지로 자동 이동하는지 확인.
3. 목록 화면에서 방금 쓴 기록이 태그와 함께 보이는지 확인.
4. 상세 화면에서 필드를 하나 수정하고 저장 → 새로고침 후에도 반영되는지 확인.
5. "STAR로 변환" 버튼을 눌러 결과가 표시되는지 확인, 재변환 시 최신 결과로 갱신되는지 확인.
6. (가능하면) 음성 입력 버튼으로 짧은 문장을 인식시켜 텍스트 입력란에 반영되는지 확인.
