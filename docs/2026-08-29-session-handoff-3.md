# 세션 기록 — 2026-08-29~30 (3차): STARWL, 엔드포인트/화면 문서화, 카드 스택·녹화 플로우 리디자인

이전 기록: `docs/2026-08-23-session-handoff.md`(1차), `docs/2026-08-23-session-handoff-2.md`(2차).
이번엔 슬라이스 03~06을 전부 완주했고, 슬라이스 05/06은 완료 후에도 여러 차례 후속 튜닝이 붙어
스펙 문서(`docs/slices/05-06`)와 실제 구현이 꽤 벌어졌습니다. 이 문서는 그 최종 상태 기준으로 씁니다.

## 이번 세션에서 끝난 것

| 슬라이스 | 내용 | 상태 |
|---|---|---|
| 03. project-collections-grid | `entries.project_title`/`collection_id`, `collections` 테이블, 기록 상세 그리드+그룹핑, 선택모드 일괄 컬렉션 지정 | main 병합·배포 완료 |
| 04. starwl-detail-layout | `star_conversions`→`starwl_conversions` 전체 리네임(테이블/타입/`/api/star`→`/api/starwl`), `why`/`learning` 필드 추가, 상세화면 좌(원문)/우(탭) 분할 | main 병합·배포 완료 |
| 화면/엔드포인트 문서화 | `docs/screens.md` 신규 작성 (플로우 3개 → 화면 목록 → 표) | 완료, 커밋됨 |
| 05. entries-card-stack | 기록 목록을 겹침 카드 스택으로 재구성 → 이후 세로 커버플로우 캐러셀로 전면 교체 | 완료 (스펙보다 크게 확장됨, 아래 참고) |
| 06. record-flow-redesign | 기록 화면을 4단계(choice→voice→typing→details) 플로우로 재구성, 실시간 마이크 파형 | 완료 |
| 부가 | Pretendard 폰트 전역 적용, 로그인 화면에 회원가입 추가(Supabase Auth 실사용 확인) | 완료 |

## STARWL (슬라이스 04) 최종 형태

- `구조화` 탭과 `STARWL` 탭이 분리됨. `구조화` 탭 안의 "STARWL로 추출"/"STARWL로 다시 추출" 버튼을
  누르기 전까지 `STARWL` 탭은 "아직 추출한 STARWL이 없습니다." 빈 상태만 보임.
- 근거성 원칙: `learning`은 입력에 realization(깨달음)이 있을 때만 채우고, 없으면 무조건 null
  (result/emotion에서 유추해서 채우는 느슨한 버전은 리뷰에서 발견 후 되돌림 — `409b947`).
- `/api/star` 관련 코드/문서 참조는 전부 정리 완료 (docs/screens.md, CLAUDE.md 포함).

## 화면/엔드포인트 문서화 (docs/screens.md) 핵심 결론

- A. 어느 화면에도 안 붙는 엔드포인트: 없음
- B. 화면엔 필요한데 엔드포인트가 없는 것: 자연어 질문 검색 (PRD §6-4) — 아직 미구현, 다음 슬라이스 후보

## 05/06이 스펙에서 얼마나 벗어났는지 (중요 — 다음 세션이 스펙 문서만 보면 오해함)

`docs/slices/05-entries-card-stack.md`는 "탭하면 펼쳐지는 겹침 카드 스택"으로 적혀 있지만,
최종적으로는 **`CardStackCarousel`이라는 범용 세로 커버플로우 컴포넌트**로 완전히 교체됐습니다:

- `src/components/CardStackCarousel.tsx` (신규, 범용): 실제 브라우저 스크롤 + CSS `scroll-snap`으로
  터치/휠/모멘텀/스냅 구현 (커스텀 물리 엔진 없음). 스크롤 위치 계산만으로 active 카드를 판정하고,
  중심에서 5장 이상 떨어진 카드는 가상화(virtualize)해서 카드 수가 늘어도 가벼움.
  거리별 scale/opacity/z-index 차등 적용, blur는 최종적으로 제거함(가독성 문제로).
  카드 높이/overlap은 모바일 뷰포트에 맞춰 200px→160px, 0.4→0.45로 재조정됨 (`ac6f9a3`).
- `src/components/EntryCardStack.tsx`: 위 캐러셀을 엔트리 카드 렌더링으로 감싼 어댑터.
  캡(최대 ~6장) 넘으면 위아래 fade-mask 스크롤 컨테이너로 전환.
- 선택모드(다중선택→컬렉션 일괄지정)는 스펙대로 캐러셀이 아니라 **기존 그리드+체크박스 UI**를 그대로 씀.
- 태그: 애초 "AI가 단 태그, 읽기 전용"이었던 게 이번에 **토글 가능**하도록 바뀜 —
  `EntryDetailPage`에서 6개 태그 칩을 전부 보여주고 클릭으로 추가/제거(낙관적 업데이트 + 실패시 롤백).
  `ALL_TAGS`가 `tagColors.ts`로 이동해 EntriesPage/EntryDetailPage가 공유.
- 정렬: `docs/slices/05`가 적었던 "정렬 버튼 나열" 대신, 실제로는 드롭다운(버튼+절대위치 패널,
  선택/바깥클릭시 닫힘)으로 구현됨.
- 카드 디자인: 태그별 그라디언트 배경(`TAG_GRADIENTS`, 3-stop from/via/to) 적용 — `design.md`에
  참조 이미지(`ref.jpg`, `녹화탭.jpg`) 기반 디자인 토큰 문서화돼 있음. 이 그라디언트 스타일은
  **카드 스택 + 녹화 화면 두 곳에만 적용**되고 나머지 앱은 기존 slate 미니멀 스타일 유지.

## 녹화 플로우 (슬라이스 06) 최종 형태

- `RecordPage`가 `step: 'choice' | 'voice' | 'typing' | 'details'` 내부 상태로 4단계 전환 (별도 URL 없음,
  새로고침하면 처음부터 다시 시작 — 스펙에서 확인 완료된 결정).
- `useMicLevel.ts` (신규): `getUserMedia` + Web Audio `AnalyserNode`로 실제 마이크 볼륨을 읽어
  `VoiceWaveform`이 장식이 아닌 실 볼륨 기반 막대 그래프를 그림. `useSpeechInput`과 별도 스트림 사용 가능함을 확인.
  `useSpeechInput.ts`는 정지/에러 후에도 기존 transcript를 지우지 않고 재시작 시 이어붙이도록 수정.
  실제 마이크/정지 아이콘(`icons.tsx` 신규)으로 placeholder div 교체.
- 구조화 실패 시: entry 자체(raw_text)는 이미 저장된 채로, `entries_structured`를
  `status: 'failed'`로 upsert(모든 필드 null) — 재시도 시 `entry_id`가 PK라 idempotent.
  완전히 건너뛰지 않고 실패 레코드를 남겨 나중에 상세 화면에서도 재시도 가능하게 함 (스펙에서 확인 완료).
- 로그인 화면(`LoginPage.tsx`)에 회원가입 추가 — `supabase.auth.signUp()` 직접 호출, 별도 profiles
  테이블 없이 `auth.users` + `user_id`만으로 충분함을 확인. **실제 라이브 Supabase 프로젝트에 이메일 확인이
  켜져 있음을 확인** — 가입 직후 세션이 안 생기고 "메일함을 확인해주세요" 분기를 실제로 탄다.

## 지금 상태

- **main**: `ac6f9a3`. `origin/main`은 `4d561d1`(Pretendard+커버플로우 교체)까지만 반영돼 있고,
  그 이후 **`f34d869`(회원가입), `e4f1af7`(블러 제거/드롭다운/태그 토글), `ac6f9a3`(모바일 센터링 수정)
  3개 커밋이 아직 push 안 됨** (`git log origin/main..main` 확인 완료, local main이 origin보다 3커밋 앞섬).
  다음 세션에서 사용자 확인 후 push 필요.
- **미커밋 변경**: `.env.example`에 빈 줄 하나 추가된 diff가 여러 세션째 남아있음 (의도 불명, 계속 보류 중).
  치우거나 커밋하거나 사용자에게 재확인 필요.
- **테스트/빌드**: 이 문서 작성 시점(`ac6f9a3`)에 재확인함 — `npm run build` 클린(85 modules),
  `npm test` 19/19 통과.
- **디자인 참고 자료**: `design.md`, `ref.jpg`, `녹화탭.jpg`, `cardscroll.jpg`가 저장소 루트에 커밋돼
  디자인 토큰/근거를 문서화하고 있음 (와이어프레임 원본은 `ECHO Wireframes.dc.html`로 언급됨, 저장소 내
  실제 위치는 미확인).

## 다음 세션 후보 / 남은 일

1. **`git push` 여부 확인** — 05/06 커밋들이 origin에 올라갔는지 우선 확인.
2. **`/api/*` 함수 인증 체크 없음** — 2차 세션부터 계속 이월되는 1순위 후보. 미인증 호출자가
   `/api/structure`, `/api/starwl`, `/api/insights`를 직접 호출해 LLM 쿼터 소모 가능.
3. **자연어 질문 검색 (PRD §6-4)** — `docs/screens.md`가 명시한, 화면엔 필요한데 엔드포인트가 없는 유일한 항목.
4. **`.env.example` 빈 줄 diff** — 계속 보류 중, 처리 필요.
5. **`docs/slices/05-06.md` 스펙 문서 자체는 갱신 안 됨** — 위 "스펙에서 얼마나 벗어났는지" 절이 실질적인
   최신 근거이니, 스펙 문서를 다시 읽을 일이 있으면 이 문서를 같이 참고할 것.
6. **프로덕션 `OPENROUTER_MODEL` 미설정** 등 2차 세션 기록에 남은 이월 항목들은 이번 세션에서 다루지 않음 —
   `docs/2026-08-23-session-handoff-2.md` 참고.

## 참고 문서

- 원본 요구사항: `PRD_ECHO.md` / 프로젝트 가이드: `CLAUDE.md`
- 화면/엔드포인트 매핑: `docs/screens.md`
- 이번 슬라이스 스펙: `docs/slices/03~06-*.md` (05/06은 위 이탈 내역 참고)
- 실행 플랜: `docs/superpowers/plans/2026-08-29-*.md`
- 디자인 토큰/근거: `design.md`
