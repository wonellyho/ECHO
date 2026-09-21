# 세션 기록 — 2026-09-21 (4차): 별자리 탭 태그 기반 재설계 + 전 화면 UI 다듬기

이전 기록: `docs/2026-08-23-session-handoff.md`(1차), `docs/2026-08-23-session-handoff-2.md`(2차),
`docs/2026-08-29-session-handoff-3.md`(3차). 이번 세션은 새 기능 슬라이스보다 **기존 화면들의
디자인/상호작용을 다듬는 반복 작업**이 대부분이었고, 그 과정에서 패턴 탭(별자리)의 근본 구조를
한 번 바꿨습니다. 커밋 하나(`8c2bfd5`)로 묶어 PR #1로 `main`에 머지 완료(`d24cb8d`).

## 이번 세션에서 가장 큰 변화: 별자리 탭 재설계

**"소진/에너지 얻는 순간 말고 다른 시각화 요소가 있을까"**라는 질문에서 시작해, 패턴 탭의 군집
기준을 완전히 바꿨습니다.

- **군집 기준**: `neutral`/`energizer`/`drainer`(에너지원·소진요인 인사이트 기반) → **태그 6종 +
  `unassigned`(태그 없는 기록)**. `ClusterId` 타입 자체가 `ExperienceTag | 'unassigned'`로 바뀜
  (`src/lib/constellation/layout.ts`).
- **별 중복**: 기록 하나가 태그를 여러 개 가지면 그 태그 군집마다 별이 하나씩 중복 생성됨.
  `StarNode.id`는 `${entryId}::${cluster}` 합성 키, 실제 DB 조회는 항상 `entryId` 기준
  (`src/lib/constellation/buildGraph.ts`).
- **군집 배치**: 7개 군집을 큰 원 위에 균등 배치(`CLUSTER_ORDER`, `RING_RADIUS=22`) — 간격을
  두 차례 조정(넓혔다가 "너무 멀다"는 피드백으로 다시 좁힘).
- **군집 크기 조절**: 편집모드에서 각 군집에 점선 박스 + 이동 손잡이(점) + 크기 손잡이(돋보기
  아이콘)가 항상 떠 있고, 크기 손잡이를 드래그하면 그 군집 전체가 중심 기준으로 방사형 확대/축소됨.
  배율은 `applyClusterScales()`로 그래프에 반영되고 `cluster_positions.scale` 컬럼에 저장됨
  (**⚠️ 아래 "직접 처리해야 할 것" 참고**).
- **인사이트(에너지원/소진요인) 기능 전체 제거**: "그냥 인사이트 다 없애줘" 요청으로 관련 UI/로직을
  들어냈습니다. 삭제된 파일: `api/insights.ts`, `src/components/constellation/ClusterSummaryCard.tsx`,
  `EvidenceList.tsx`, `src/lib/buildInsightRows.ts`(+테스트). `insights` DB 테이블 자체와
  `EntryDetailPage`의 "패턴" 탭(개별 기록에 연결된 인사이트 표시)은 건드리지 않음 — 다만 인사이트를
  더 이상 아무도 생성하지 않으므로 그 탭은 앞으로 항상 비어 있을 것.
- **시점 이동**: 방향키(상하좌우) 추가 — OrbitControls의 드래그 팬은 별무리 드래그와 제스처가
  겹쳐서 못 쓰고, 대신 화면 가장자리 버튼으로 카메라+시선을 함께 미는 방식. 기존 카메라 포커스
  트윈에 얹어서 부드럽게 움직임.
- **태그별 통계 드롭다운**: 방향키 위에 작은 토글 — 열면 태그 7종(6종+미분류)의 개수가 표로 보임.
  **여기서 진짜 까다로운 버그**가 있었다: 드롭다운 패널을 `absolute` + `left-1/2 -translate-x-1/2`
  + `w-max`(내용만큼 좁게, 가운데 정렬)로 만들었더니, `overflow-hidden`과 결합한 shrink-to-fit
  너비 계산이 브라우저에서 불안정하게(40~180px로 제멋대로) 나와 태그 하나만 보이는 문제가 반복
  발생. table→flex로 마크업을 바꿔봐도 원인이 폭 계산 자체였어서 안 고쳐졌고, **브라우저에 직접
  스타일을 주입해 `getBoundingClientRect()`로 실측**해서야 원인을 확정함. 최종 해법은 패널 너비를
  shrink-to-fit에 맡기지 않고 `inset-x-4`(화면 폭 기준 고정)로 명시하고 `grid-cols-7`로 정확히
  7칸 배분 — 스크롤 없이 한 화면에 다 들어옴.

## 그 외 화면별 변경

| 화면 | 변경 내용 |
|---|---|
| 로그인 (`LoginPage.tsx`) | 로고를 `xl` 사이즈로 확대해 카드 위 중앙 배치, 카드/입력창 배경 알파를 0.05까지 낮추고 blur 완전 제거(진짜 투명), 소셜 로그인 버튼을 텍스트 없는 원형 아이콘으로 단순화, "계정이 없으신가요?" 하단 링크 제거(상단 탭으로 대체), 우측 상단 안내문구 제거, 브라우저 자동완성 회색 배경 오버라이드(`index.css`) |
| 기록 (`RecordPage.tsx`) | 로고 확대(`lg`), 홈 화면 문구 교체, 녹음 오브·마이크 아이콘 배경 알파 상향(너무 투명해 비활성처럼 보이던 문제), 음성 파형 진폭 증가(`VoiceWaveform.tsx` `BAND_GAIN`/`PEAK_HEIGHT`), STARWL 추출 진행바 + 완료시 자동 탭 전환, 컬렉션 선택을 네이티브 `<select>`→커스텀 드롭다운(모바일 화면 초과 문제 해결), "기록 저장하기" 바를 nav 위에 고정 |
| 내 경험 (`EntriesPage.tsx`) | 편집모드 카드의 수정/삭제 버튼을 "⋯" 더보기 메뉴로 통합(다닥다닥 붙어 오조작하던 문제 해결), 전체선택/전체해제 + 일괄삭제 추가, 하단 바 컬렉션 선택도 커스텀 드롭다운으로 교체, "컬렉션 모음" 모달 리스트 항목 구분감 강화 + 높이를 `max-h`로(빈 여백 제거) |
| 기록상세 (`EntryDetailPage.tsx`) | 뒤로가기/원문/태그/탭을 고정 헤더로, 탭 내용만 내부 스크롤(전체 페이지 스크롤 없앰), 원문 카드에 "기록 원문" 라벨 추가, STARWL 카드 배경 투명화 |
| 내 정보 (`ProfilePage.tsx`) | 로그아웃을 우측 상단 아이콘 버튼으로 단순화, 닉네임 카드를 계정 요약보다 위로, "지금까지 남긴 기록" 토글에 태그별 개수 표시 추가 |
| 공용 컴포넌트 | `Logo.tsx`: 실제 로고 이미지(1254×420, 3:1)를 정사각형 크롭하던 버그 수정(`object-contain`+`w-auto`로 전환), size prop(`default`/`lg`/`xl`) 추가 / `GlassCard.tsx`(`GlassPanel` ghost 톤), `CosmicInput.tsx`, `CosmicButton.tsx`(`CosmicIconButton`): 투명도·블러 여러 차례 조정 / `icons.tsx`: `MoreIcon` 회전 활용, `TargetIcon`·`LogOutIcon`·`ChevronUp/DownIcon` 신규 |

## 반복된 시행착오 — 다음에 같은 실수 안 하려면

1. **"배경이 안 보인다" 피드백이 여러 번 반복된 이유**: 알파(불투명도)만 낮추는 걸로는 부족했다.
   `backdrop-blur-xl`(24px) 같은 강한 블러는 알파를 아무리 낮춰도 뒤 배경을 뭉갠 흐릿한 덩어리로
   만들어버린다. 최종적으로 alpha와 blur 둘 다 낮춰야(또는 blur를 아예 없애야) 진짜 반투명 유리
   처럼 보인다.
2. **absolute + shrink-to-fit(`w-max`) + `overflow-hidden` 조합은 폭 계산이 불안정하다** — 특히
   `display:grid`의 auto 트랙 사이징과 겹치면 더 심해진다. 내용만큼 좁게 가운데 정렬하고 싶은
   드롭다운/패널은 shrink-to-fit에 맡기지 말고, 가능하면 `inset-x-*`처럼 명시적 폭을 주는 쪽이
   훨씬 안전하다.
3. **레이아웃 버그는 추측으로 두 번 고치려 하지 말고 브라우저에서 직접 재봐야 한다** — 이번에
   table→flex로 바꿔도 안 고쳐진 이유가 바로 이거였다(진짜 원인은 마크업이 아니라 부모 폭
   계산이었음). `javascript_tool`로 실제 페이지(또는 인증이 필요 없는 페이지에 임시로 같은
   클래스를 주입)에서 `getBoundingClientRect()`/`getComputedStyle()`을 찍어보는 게 가장 빠르다.
4. **Vite 개발 서버의 Tailwind는 소스에 실제로 쓰인 클래스만 컴파일한다** — 브라우저에 임의로
   `grid-cols-7` 같은 클래스를 주입해 테스트했는데 처음엔 안 먹혔다. 소스 파일에 그 클래스를
   먼저 추가해 HMR이 반영되게 한 다음에 재검증해야 유효한 테스트가 된다.

## 직접 처리해야 할 것 (⚠️ 중요)

1. **Supabase DB 마이그레이션 미실행 가능성** — `cluster_positions` 테이블에 `scale` 컬럼을
   추가하는 마이그레이션을 세션 중 두 번 안내했다. 아직 안 돌렸다면 별무리 위치를 옮길 때마다
   "저장하지 못했습니다" 에러가 계속 뜬다(코드가 이제 이 에러를 감지해 이 사실을 알려주긴 하지만,
   근본 해결은 아래 SQL 실행뿐):
   ```sql
   alter table cluster_positions add column if not exists scale double precision not null default 1;
   ```
2. **PRD/CLAUDE.md 성공 기준과의 괴리** — `CLAUDE.md`의 Day14 성공 기준(PRD §8)에는 "근거 있는
   에너지원/소진요인 3개씩"이 명시돼 있는데, 이번 세션에서 그 기능(인사이트 생성·표시) 자체를
   사용자 요청으로 껐다. 사용자가 제품 방향을 태그 시각화 쪽으로 재우선순위한 것으로 보이지만,
   `CLAUDE.md`/`PRD_ECHO.md`는 아직 갱신되지 않았다 — 데모 전에 이 성공 기준을 그대로 쓸지,
   태그 통계 쪽으로 대체할지 사용자와 재확인 필요.
3. **`feature/constellation-insights` 브랜치 정리 여부** — main에 머지 완료(PR #1,
   머지 커밋 `d24cb8d`)했지만 브랜치 자체는 안 지웠다. 삭제해도 되는지 확인 필요.

## 참고 문서

- 원본 요구사항: `PRD_ECHO.md` / 프로젝트 가이드: `CLAUDE.md`
- 화면/엔드포인트 매핑: `docs/screens.md` (이번 세션 변경사항 반영 안 됨 — 인사이트 관련 엔드포인트
  삭제 등을 다음에 갱신할 것)
- 이전 세션 기록: `docs/2026-08-23-session-handoff.md`, `-2.md`, `docs/2026-08-29-session-handoff-3.md`
- 이번 세션 커밋: `8c2bfd5` (feature 브랜치) → PR #1 → `d24cb8d` (main 머지 커밋)
