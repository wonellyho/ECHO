# ECHO

경험을 기록하고, 나를 발견하다. 자세한 배경은 `PRD_ECHO.md`, 기술 구조/컨벤션은 `CLAUDE.md`를 참고하세요.

## 로컬 개발

```bash
npm install
cp .env.example .env.local   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 채우기
npm run dev                  # 프론트만 (Vite, /api 호출은 실패함)
```

`/api` 서버리스 함수까지 함께 테스트하려면 Vercel CLI로 실행하세요.

```bash
npm run dev:vercel           # ANTHROPIC_API_KEY 등은 vercel env pull 또는 .env로 준비
```

Supabase 프로젝트에는 `supabase/schema.sql`을 SQL Editor에서 실행해 테이블/RLS를 생성합니다.

## 스크립트

- `npm run dev` — Vite 개발 서버
- `npm run dev:vercel` — Vercel CLI로 프론트 + `/api` 함께 실행
- `npm run build` — 타입체크(`tsc -b`) + 프로덕션 빌드
- `npm run typecheck:api` — `/api` 서버리스 함수 타입체크
- `npm run lint` — oxlint
