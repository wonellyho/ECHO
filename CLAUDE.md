# ECHO — 프로젝트 가이드 (Claude Code용)

이 문서는 세션이 새로 시작될 때마다 프로젝트 맥락을 빠르게 파악하기 위한 최상단 참조 문서입니다.
전체 요구사항은 `PRD_ECHO.md`를 원본으로 삼고, 여기서는 "어떻게 만들고 있는지"를 기록합니다.

## 한 줄 요약
경험 직후 상황·행동·감정을 텍스트/음성으로 기록하면 AI가 구조화·태깅하고,
반복 기록에서 에너지원/소진요인 패턴과 STAR 형식 면접 소재를 뽑아주는 모바일 우선 웹서비스.

## 기술 스택 (PRD 대비 변경 사항 포함)
- **프레임워크**: Vite + React + TypeScript (SPA). ⚠️ PRD 원문은 "Next.js"를 명시하지만,
  사용자 요청으로 React(Vite)로 결정. Vercel은 Next.js 없이도 정적 프론트 + `/api` 서버리스 함수 배포를 지원하므로
  "Vercel 배포" 요구사항 자체는 그대로 충족.
- **백엔드/DB/Auth**: Supabase (Postgres + Auth 이메일/비번 + RLS). 스키마는 `supabase/schema.sql`.
- **서버 로직**: Vercel Functions (`/api/*.ts`, `@vercel/node`). API 키(ANTHROPIC_API_KEY)는 반드시 여기서만 사용하고
  프론트(Vite `VITE_*` env)로 절대 노출하지 않는다.
- **LLM**: `api/_lib/llm.ts`의 `callLlmJson()`이 단일 진입점. 기본은 **OpenRouter 무료 모델**(비용 0원)로 시도하고,
  실패(요청 제한/네트워크 오류/JSON 파싱 실패)하면 **Claude Haiku로 자동 폴백**한다. `OPENROUTER_API_KEY`가 없으면
  바로 Claude로 간다. 무료 모델 라인업은 자주 바뀌므로 `OPENROUTER_MODEL` 환경변수로 override 가능
  (기본값은 코드 내 `DEFAULT_OPENROUTER_MODEL`, 주기적으로 openrouter.ai/models에서 max_price=0으로 확인 필요).
- **STT(음성 인식)**: 1차는 브라우저 내장 Web Speech API(무료)로 시작. 정확도 문제가 실제로 확인되면
  그때 Whisper 등 유료 STT 도입을 검토한다. 지금 단계에서 미리 붙이지 않는다.

## 폴더 구조
```
/api                  Vercel 서버리스 함수 (LLM 호출 등 키가 필요한 로직만)
  /_lib/llm.ts         LLM 호출 공통 헬퍼 (OpenRouter 무료 모델 → Claude Haiku 폴백)
  /_lib/auth.ts        호출자 인증 — Supabase 세션 토큰 검증 (아래 "API 보호" 참고)
  /_lib/rateLimit.ts   사용자별 호출 제한 (인메모리, best-effort)
  structure.ts         기록 → 상황/역할/갈등/행동/결과/감정/이유 + 태그 구조화
  starwl.ts             구조화 데이터 → STARWL(Why/Learning 포함) 변환
  (예정) insights.ts     반복 기록 → 에너지원/소진요인 요약(근거 entry_id 포함)
/src
  /lib/supabaseClient.ts  프론트에서 쓰는 Supabase 클라이언트 (anon key)
  /lib/apiClient.ts       /api 호출 단일 창구 — 세션 토큰을 자동으로 실어 보낸다
  /lib/routes.ts          라우트 경로 상수 (앱은 /app 아래, "/"는 공개 랜딩)
  /types/index.ts         공용 타입 (Entry, EntryStructured, Insight, StarWlConversion 등)
  /pages                  화면 단위 컴포넌트
  /components             재사용 UI 컴포넌트
/supabase/schema.sql   DB 스키마 + RLS 정책 (Supabase SQL Editor에서 직접 실행)
PRD_ECHO.md            원본 요구사항 (변경 금지, 항상 최신 기준으로 참조)
```

## 데이터 흐름 원칙
- 클라이언트는 자기 Supabase 세션(anon key + RLS)으로 직접 읽고 쓴다. `/api` 함수는 상태를 갖지 않고
  "LLM에게 물어서 JSON 결과를 돌려주는" 역할만 한다 — service role key는 쓰지 않는다.
- 구조화/인사이트 결과는 **반드시 근거가 된 원본 기록(entry_id)과 함께 저장**한다.
  기록에 없는 성격·동기를 단정하지 않는다는 PRD 요구사항(§7 근거성)을 지키기 위함이며,
  프롬프트 작성 시 이 규칙을 항상 시스템 프롬프트에 명시할 것.
- 태그는 `협업/갈등/주도성/실패/성취/문제해결` 6종으로 고정(DB CHECK 제약 있음). LLM이 이 외의 값을 반환하면
  서버 함수에서 필터링해서 버린다.

## API 보호 (요금이 나가는 경로)
`/api/*`는 호출 한 번마다 LLM 요금이 발생한다. 그래서 **모든 LLM 엔드포인트는 다음 3단 관문을
순서대로 거친 뒤에야 `callLlmJson()`에 도달한다.** 새 엔드포인트를 추가할 때도 같은 순서를 지킬 것.

1. **인증** — `requireUser(req, res)` (`api/_lib/auth.ts`). 클라이언트가 보낸 Supabase 세션
   토큰을 Supabase에 되물어 확인한다. 이게 없으면 인터넷 누구나 curl로 크레딧을 태울 수 있다.
   설정이 빠지면 통과시키지 않고 **막는다**(fail closed).
2. **호출 제한** — `checkRateLimit("<user.id>:<endpoint>", LLM_RATE_LIMIT)`.
3. **입력 길이 상한** — 입력 길이에 요금이 비례하므로 상한이 없으면 1회 비용에 상한이 없다.

프론트는 `fetch`를 직접 쓰지 말고 반드시 `src/lib/apiClient.ts`의 `postJson()`을 쓴다 —
토큰을 붙이는 곳이 흩어지면 어느 화면 하나만 조용히 401을 받는다.

⚠️ 호출 제한은 인메모리라 서버리스 인스턴스 단위다(정확한 쿼터가 아님). **금액의 실제 상한은
Anthropic Console의 지출 한도(spend limit)** 이므로 반드시 함께 설정해 둘 것.

## 만들지 않는 것 (PRD §6 재확인)
완성형 자소서 자동 작성, 면접 음성 평가, SNS/공유/랭킹, MBTI식 고정 유형 분류,
정신건강 진단/상담, 외부 캘린더·학교 시스템 연동. 스코프 벗어나는 요청이 오면 PRD를 먼저 확인.

## 환경 변수
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — 프론트 (`.env.local`)
- `ANTHROPIC_API_KEY` — Vercel 서버리스 함수 전용, OpenRouter 실패 시 폴백용 (Vercel 프로젝트 환경변수로만 설정)
- `OPENROUTER_API_KEY` — Vercel 서버리스 함수 전용, 무료 모델 1차 시도용
- `OPENROUTER_MODEL` (선택) — 기본 무료 모델을 바꾸고 싶을 때만 설정

## 일정 (Day 14 데모 기준)
1~4일차 셋업/인증/기록 입력, 5~7일차 구조화 파이프라인, 8~9일차 음성 입력,
10~11일차 검색, 12일차 STAR 변환, 13일차 인사이트 요약, 14일차 데모 준비.
성공 기준은 PRD §8 그대로: 경험 5개+ 기록, 질문 기반 검색, STAR 변환, 근거 있는 에너지원/소진요인 3개씩, 회상 가능성.

## 작업 시 주의
- 이 문서와 실제 코드가 어긋나면 코드가 아니라 이 문서를 갱신할 것 (구조 변경 시 위 섹션들 업데이트).
- PRD를 임의로 재해석하지 말고, 스코프 관련 결정이 필요하면 사용자에게 먼저 확인.
