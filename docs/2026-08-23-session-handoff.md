# 세션 기록 — 2026-08-23 (핵심 루프 배포 + 버그 조사)

이 문서는 다음 세션(아키텍처 브레인스토밍/재작업)을 시작하기 전에 오늘 세션에서
무엇을 했고, 무엇이 끝났고, 무엇이 안 끝났는지 넘겨주기 위한 기록입니다.

## 오늘 목표
배포된 URL에서 핵심 기능(기록 → 목록/상세 → STAR 변환) 하나가 처음부터 끝까지
동작하는 것. **끝까지 완료되지 않았습니다** — 마지막에 AI 구조화/STAR API가 실제로
정상 동작하는지 조사하다가 세션이 끊겼습니다. 아래 "미해결 이슈"가 핵심입니다.

## 한 일 (순서대로)

1. **PRD/CLAUDE.md 기반으로 오늘 범위 확정**: 기록작성 → 목록/상세 → STAR 변환을
   하나의 슬라이스로 묶음(순차 의존관계 때문에 의도적으로 하나로 유지 — 근거는
   `docs/superpowers/specs/2026-08-23-echo-core-loop-design.md` 참고). 인사이트,
   자연어 검색, 회원가입은 범위 밖.
2. **프론트엔드를 Tailwind CSS로 재작성** (`407ece7`) — 스펙은
   `docs/superpowers/specs/2026-08-23-echo-core-loop-design.md`.
3. **다시 요청받아 Tailwind 스타일을 걷어내고 로직만 남긴 스켈레톤으로 되돌림**
   (`1763a96`) — App/Login/Record/Entries/EntryDetail 5개 파일, 로직은 그대로 유지.
4. **슬라이스 문서화 방식 확립** (메모리에 저장됨, 이 프로젝트 세션에 계속 적용됨):
   - 앞으로 기능은 독립 슬라이스로 쪼개 각자 스펙+플랜을 가짐 (순차 의존이 강할
     때만 예외적으로 묶음)
   - 스펙은 `기능 N / 완료조건 / 안되는경우 / 이번에안하는것 / 건드릴파일 /
     확인방법 / 물어볼것` 체크리스트 템플릿 사용
   - 첫 적용 결과물: `docs/slices/01-core-loop.md`
5. **슬라이스 01을 TDD로 보강** (`9752eff`, `d491d35`):
   - vitest 도입 (`npm run test`)
   - `canSubmitRecord`(`src/lib/recordValidation.ts`), `filterEntries`
     (`src/lib/entryFilter.ts`)를 RED→GREEN으로 추출, RecordPage/EntriesPage에 연결
6. **Vercel 배포 확인/설정**: `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`,
   `OPENROUTER_MODEL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 프로덕션에
   등록 확인. 여러 번 `vercel --prod`로 배포.
7. **Claude in Chrome로 실제 배포 URL 클릭 테스트** — 로그인/기록작성/목록/상세는
   정상 동작 확인. **AI 구조화(`/api/structure`)와 STAR 변환(`/api/star`)이
   불안정하게 실패**하는 걸 발견 → 아래 미해결 이슈로 이어짐.

## 미해결 이슈: AI 구조화/STAR가 신뢰할 수 없음

### 지금까지 확인된 사실
- 기존 `OPENROUTER_MODEL=nvidia/nemotron-3-nano-30b-a3b:free` → 입력 무시하고 항상
  전부 `null`인 JSON만 반환 (실제 브라우저 요청으로 확인됨, curl 인코딩 문제 아님).
- `meta-llama/llama-3.3-70b-instruct:free`로 교체 시도 → 이 모델의 무료 티어가
  단종됨 (OpenRouter가 404로 유료 버전 안내).
- `dots-studio/dots-3-note-preview:free`로 교체 시도, Claude(Anthropic) 폴백 강제
  테스트 → **둘 다 입력과 무관한 내용을 지어내는 것처럼 보였음** (예: "발표 자료"
  얘기를 넣었는데 "팀 갈등" 얘기를 만들어 답함).
- 마지막에 `api/structure.ts`에 임시 진단 로그를 추가해 확인해보니, **curl로 직접
  테스트할 때 한글 `raw_text`가 서버에 깨진 상태(mojibake)로 도착**하고 있었음.
  → 지금까지 "모델이 내용을 지어낸다"고 판단한 것 중 상당수가 **내 터미널(curl)의
  인코딩 문제 때문일 가능성**이 있음. 브라우저(실제 fetch)는 UTF-8을 정확히
  보내므로 이 문제가 없을 수 있음.
- 이걸 확인하려고 브라우저로 재테스트하려는 순간 Claude in Chrome 확장 연결이
  끊겨서 **최종 확인은 못 하고 세션이 끝났습니다.**

### 결론적으로 다음 세션에서 반드시 먼저 할 일
1. **브라우저로 직접** (curl 말고) `/api/structure`, `/api/star`가 실제로 입력
   내용에 맞는 결과를 주는지 확인. curl 인코딩 문제였다면 원래 모델
   (`nvidia/nemotron-3-nano-30b-a3b:free`)만 문제였을 수도 있고, 아닐 수도 있음 —
   재확인 필요.
2. 위 진단 로그(`api/_lib/llm.ts`, `api/structure.ts`에 `[diag]` 표시된 부분,
   **커밋 안 됨, `git diff`로 확인 가능**)는 원인 확정되면 지울 것.

## 지금 배포/환경 상태 (다음 세션 시작 시 꼭 확인)

- **프로덕션 URL**: https://echo-seven-phi-26.vercel.app/ — 마지막 커밋
  (`d491d35`, 슬라이스 01 TDD)까지 배포되어 있음. `OPENROUTER_MODEL`이 프로덕션에
  없는 상태라 코드 기본값(`z-ai/glm-5.2:free`, **미검증 모델**)을 씀. 구조화/STAR가
  될지 안 될지 불확실.
- **Vercel 환경변수 현황** (`vercel env ls` 기준):
  - `OPENROUTER_MODEL`: **Preview에만** 설정되어 있음(디버깅 중 테스트용 값,
    지금은 `invalid/force-claude-fallback-test`라는 일부러 깨뜨린 값). 프로덕션엔
    없음 — 정리 필요.
  - `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`: Preview+Production 둘 다 설정됨.
    Anthropic은 오늘 크레딧 충전함.
- **디버깅용 프리뷰 배포가 여러 개 쌓여 있음** (`echo-nmfpec897-...`,
  `echo-c56wdxqin-...`, `echo-pa094yr92-...`, `echo-ptnuo14ga-...`,
  `echo-p2f5d9awk-...` 등) — 정리(삭제)는 안 했음. `vercel ls`로 확인 가능.
- **커밋 안 된 변경사항**: `api/_lib/llm.ts`, `api/structure.ts`에 임시 진단
  `console.log` 추가돼 있음 (RED/GREEN 없이 바로 추가한 디버깅 코드 — TDD 대상
  아님, 정식 커밋 안 함).

## 참고 문서 위치
- 원본 요구사항: `PRD_ECHO.md`
- 프로젝트 가이드: `CLAUDE.md`
- 오늘 슬라이스 스펙: `docs/slices/01-core-loop.md`
- 오늘 디자인 스펙(프론트 재작성): `docs/superpowers/specs/2026-08-23-echo-core-loop-design.md`
- 오늘 실행 플랜: `docs/superpowers/plans/2026-08-23-echo-core-loop-plan.md`
- 슬라이싱/스펙 템플릿 워크플로 결정 사항: Claude Code 메모리
  (`feature-slicing-approach`, `spec-template-format` — 자동으로 다음 세션에도
  적용됨, 이 저장소 안에는 없음)
