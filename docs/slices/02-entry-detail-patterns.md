# 기능 2: 기록 상세에서 구조화/STAR와 내 패턴을 탭으로 나눠 보고, 깨달음도 기록한다

## 완료 조건
(최대 5개까지. 눈으로 확인 가능한 것만)

- [ ] 기록 상세 화면에서 구조화 결과 7개 필드 중 하나로 "깨달음"이 보인다(없으면 `-`)
- [ ] 기록 상세 화면에 `구조화/STAR` 탭과 `패턴` 탭이 있고, 클릭으로 전환된다
- [ ] `/insights` 화면(네비게이션 "패턴" 링크)에서 "다시 분석하기"를 누르면 전체 기록 기반 energizer/drainer가 DB에 저장되고 화면에 보인다
- [ ] 기록 상세의 `패턴` 탭에서, 그 기록이 근거로 포함된 energizer/drainer만 카드로 보인다(없으면 "관련 패턴 없음 + 전체 패턴 보러가기" 안내)
- [ ] 탭/카드/태그칩에 색상·그림자 등 가벼운 스타일이 입혀져 있다(EntryDetailPage, InsightsPage, NavBar만)

## 안 되는 경우
(여기 안 적으면 처리도 안 됩니다)

- 구조화 결과에 "깨달음"이 기록에 명시적으로 드러나지 않으면 → null로 남고 화면엔 `-`로 보인다 (다른 필드와 동일 규칙)
- `/insights` 재생성 중 DB 삭제 후 insert가 실패하면 → "재생성에 실패했습니다. 다시 시도해주세요" + 재시도 버튼, 상태 복구는 시도하지 않는다
- 기록이 3개 미만이면(`MIN_ENTRIES_FOR_INSIGHTS`) → `/insights`에서 지금처럼 "N개 이상 쌓이면 분석" 안내만 보이고 생성 자체를 막는다
- 기록 상세 `패턴` 탭 진입 시 저장된 인사이트가 하나도 없으면(아직 한 번도 전체 분석을 안 돌렸으면) → 빈 상태 안내 + `/insights` 링크만 보여주고, 그 자리에서 LLM을 새로 호출하지 않는다
- 로그인 안 한 상태로 `/insights` 접근 → 기존 라우팅 규칙대로 로그인 화면으로 보내진다

## 이번에 안 하는 것
(안 적으면 시키지 않은 것까지 만들어 옵니다)

- 인사이트 자동/주기적 재생성 — 여전히 수동 "다시 분석하기" 버튼으로만
- 인사이트 이력/버전 관리 — 재생성하면 기존 것은 삭제하고 교체(누적 안 함)
- energizer/drainer 외 새로운 패턴 카테고리 확장
- STAR 변환에 "깨달음" 반영 — STAR는 지금 입력(situation/role/conflict/action/result)만 그대로 사용
- `api/insights.ts` 입력에 realization 추가 — emotion/emotion_reason만으로 충분, 성격·동기 단정 금지 규칙과 충돌 우려로 보류
- `RecordPage`/`EntriesPage`/`LoginPage` 리스타일링 — 지난번에 의도적으로 스켈레톤으로 되돌린 화면이라 이번엔 손대지 않음
- 다크모드, 반응형 세밀 조정, 커스텀 폰트/아이콘셋
- 지난 세션 미해결 이슈(OpenRouter 무료 모델의 신뢰성 자체)를 규명하는 것 — 이번 슬라이스는 그 조사 중 남은 `[diag]` 콘솔 로그만 제거

## 건드릴 파일
(새로 만들 파일 / 고칠 파일)

- **수정**: `supabase/schema.sql` — `entries_structured`에 `realization text` 컬럼 추가 (+ Supabase SQL Editor에 직접 `alter table` 실행)
- **수정**: `src/types/index.ts` — `EntryStructured.realization: string | null` 추가
- **수정**: `api/structure.ts` — `StructureResult`/시스템 프롬프트 JSON 스키마에 `realization` 추가, 임시 `[structure][diag]` 로그 제거
- **수정**: `api/_lib/llm.ts` — 임시 `[llm][diag]` 로그 제거
- **수정**: `src/pages/EntryDetailPage.tsx` — `STRUCTURED_FIELDS`에 깨달음 추가, 탭 상태(`star`/`pattern`) 추가, 패턴 탭에서 `insights` 테이블을 `evidence_entry_ids`로 조회, 가벼운 Tailwind 스타일
- **수정**: `src/pages/InsightsPage.tsx` — 마운트 시 자동 재생성 제거하고 저장된 것만 조회, "다시 분석하기" 클릭 시에만 delete+insert로 DB 교체, 가벼운 Tailwind 스타일
- **수정**: `src/App.tsx` — `/insights` 라우트 연결, `NavBar`에 "패턴" 링크 추가(+ 가벼운 스타일)
- **불변**: `api/star.ts`, `api/insights.ts` — 로직 변경 없음

## 확인 방법
(테스트 + 직접 눌러볼 순서)

1. `npm run test` — 기존 테스트(recordValidation, entryFilter) 통과 확인 (이번 슬라이스는 계산/판단 로직 추가가 없어 새 단위 테스트 대상은 없음 — "물어볼 것" 참고)
2. `npm run build` — 타입체크/빌드 통과 확인 (schema 변경에 맞춰 `EntryStructured` 타입 정합성 포함)
3. 배포 URL에서: 새 기록 작성 → 상세에서 "깨달음" 필드가 보이는지 확인
4. 네비게이션 "패턴" 클릭 → `/insights`에서 "다시 분석하기" → energizer/drainer가 뜨고, 새로고침해도 남아있는지(=DB 저장 확인)
5. 방금 생성된 인사이트에 근거로 포함된 기록 하나를 상세에서 열어 `패턴` 탭 클릭 → 관련 카드만 보이는지 확인
6. 근거로 포함 안 된 다른 기록 상세의 `패턴` 탭 → "관련 패턴 없음" 안내 확인
7. 기록 3개 미만인 새 계정으로 `/insights` 접근 → 안내 문구만 보이고 생성 버튼이 동작 안 하는지 확인

## 물어볼 것
(내가 정해줘야 하는 것)

- ~~탭 위치(전역 네비 vs 상세 페이지 내부)~~ → 확인 완료: 상세 페이지 내부에 `구조화/STAR` / `패턴` 두 탭
- ~~인사이트 저장 시점~~ → 확인 완료: DB 저장, 상세 탭은 조회만
- ~~재생성 시 기존 인사이트 처리~~ → 확인 완료: 삭제 후 교체(누적 안 함)
- ~~깨달음 필드 추가 여부~~ → 확인 완료: 추가
- ~~UI 스타일링 수준~~ → 확인 완료: 카드/버튼/태그칩에 색상·그림자·간단한 애니메이션 (Tailwind, 이번 슬라이스가 건드리는 화면만)
- 남은 것 없음 — 실행 플랜 작성 단계로 넘어감
