# 기능 4: 기록 상세를 좌우 분할로 보고, STAR를 Why·Learning까지 포함한 STARWL로 확장한다

## 완료 조건
(최대 5개까지. 눈으로 확인 가능한 것만)

- [ ] 넓은 화면에서 기록 상세가 좌(원문) / 우(구조화·STARWL/패턴 탭) 2단으로 보인다
- [ ] 좁은 화면(모바일)에서는 기존처럼 원문이 위, 탭이 아래로 세로 배치된다
- [ ] "STARWL로 변환"을 누르면 Situation/Task/Action/Result/Why/Learning 6개가 같은 레벨의 카드로 보인다
- [ ] Why/Learning도 새로고침해도 남아있다 (DB 저장 확인)
- [ ] 기존에 저장된 STAR 결과(Why/Learning 없음)를 다시 열어도 에러 없이 보이고, 두 필드는 `-`로 표시된다

## 안 되는 경우
(여기 안 적으면 처리도 안 됩니다)

- `why`의 근거(갈등/역할/감정 이유)가 부족하면 → null로 남고 화면엔 `-` (다른 필드와 동일 규칙)
- `learning`은 구조화 단계의 `realization`(깨달음)이 있으면 그걸 다듬어 쓰고, 없고 근거도 부족하면 → null
- STARWL 변환(`/api/starwl`) 호출이 실패했을 때 → 기존과 동일하게 에러 문구 + 재시도 가능 (동작 자체는 안 바꿈)
- 로그인 안 한 상태로 접근 → 기존 라우팅 규칙대로 로그인 화면으로

## 이번에 안 하는 것
(안 적으면 시키지 않은 것까지 만들어 옵니다)

- 좌우 분할 비율 사용자 커스터마이징 — 고정 비율(좌 1 : 우 1.2)
- 패턴 탭 자체의 동작 변경 — 오른쪽 컬럼으로 위치만 옮겨감, 내부 로직/쿼리는 그대로
- Why/Learning을 STAR 재변환 없이 기존 데이터에 소급 생성(백필) — 새로 변환할 때만 채워짐
- `star_conversions`/`StarConversion`이 아닌 다른 테이블·타입(예: `entries_structured`)의 이름 변경 — 이번 리네임은 STAR 관련 것에 한정

## 건드릴 파일
(새로 만들 파일 / 고칠 파일)

- **DB**: `supabase/schema.sql` — `star_conversions` → `starwl_conversions` 테이블·정책 리네임 + `why`/`learning` 컬럼 추가 (+ Supabase SQL Editor에 직접 실행, 기존 데이터 보존됨)
- **리네임**: `api/star.ts` → `api/starwl.ts` (라우트 `/api/star` → `/api/starwl`), `StarResult`에 `why`/`learning` 추가, 입력 타입에 `realization` 명시, 시스템 프롬프트 규칙 추가
- **수정**: `src/types/index.ts` — `StarConversion` → `StarWlConversion` (필드 `why`, `learning` 추가)
- **수정**: `src/pages/EntryDetailPage.tsx` — 좌우 분할 레이아웃(`lg` 이상 grid, 그 이하 기존 세로 배치), `.from('star_conversions')` → `.from('starwl_conversions')`, fetch 경로 `/api/starwl`, STARWL 카드 6개 표시, 버튼/탭 라벨 텍스트 변경
- **수정**: `CLAUDE.md` — 폴더 구조 설명의 `star.ts` → `starwl.ts` 갱신

## 확인 방법
(테스트 + 직접 눌러볼 순서)

1. `npm run test` — 기존 테스트 계속 통과 확인 (이번 슬라이스는 새 단위테스트 대상 없음 — 레이아웃/프롬프트 변경 위주)
2. `npm run build` — 타입체크/빌드 통과 확인 (리네임된 타입/테이블명 정합성 포함)
3. `npm run dev:vercel`에서: 브라우저 창을 넓게 해서 좌우 분할 확인 → 좁게 줄여서 세로 배치로 바뀌는지 확인
4. 기록 상세에서 "STARWL로 변환" → 6개 카드(S/T/A/R/W/L) 확인
5. 깨달음(realization)을 입력해둔 기록으로 변환해서 Learning이 그 내용을 반영하는지 확인
6. 깨달음 없이 근거도 부족한 기록으로 변환해서 Why/Learning이 `-`로 뜨는지 확인
7. 리네임 이전에 이미 저장돼 있던 STAR 결과(있다면)를 다시 열어 에러 없이 보이는지 확인

## 물어볼 것
(내가 정해줘야 하는 것)

- ~~좌우 분할 모바일 처리~~ → 확인 완료: 넓은 화면만 좌우, 좁은 화면은 세로
- ~~WL 표기~~ → 확인 완료: "Why"/"Learning" 영문 그대로
- ~~Why/Learning 동일 레벨 적용 범위~~ → 확인 완료: DB/타입명까지 통일 (`starwl_conversions`/`StarWlConversion`)
- 남은 것 없음 — 실행 플랜 작성 단계로 넘어감
