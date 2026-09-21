# 앱 전체 다크 테마 전환 — 설계

날짜: 2026-08-30
관련: `design.md`(태그 그라디언트/카드스택/녹음화면 토큰), Figma 파일 `ECHO`
(`https://www.figma.com/design/ty3Jt8ZekM631WrZjJGgzJ/ECHO`)의 사용자 메모

## 배경 / 범위

Figma `ECHO` 파일은 완성 디자인이 아니라 레퍼런스 이미지 2장(다크 핀테크 지갑 앱, 라이트 사진 갤러리
앱) + 사용자가 직접 쓴 요구사항 텍스트 메모로 구성된 무드보드였다. 메모 중 "앱의 전체적인 UI도 이
화면처럼 어둡고 모던하게 해줘"를 이번 슬라이스로 분리해서 먼저 진행한다. 같은 메모에 있던 하단
nav바 구조 변경, "내경험" 탭 스와이프 컬렉션, 키워드 검색/태그/정렬 필터 화면은 서로 독립된
화면/기능이라 각각 별도 스펙으로 다룬다(`[[feature-slicing-approach]]`).

`design.md`는 2026-08-30 로그인/가입 리디자인 때 "다크모드 전환은 이번에 안 함, 라이트 배경 유지"로
명시했었으나, 이번 Figma 메모 요청에 따라 그 결정을 뒤집고 앱 전체를 다크 단일 테마로 전환하기로
사용자와 합의했다(라이트/다크 토글 없음).

## 이번에 하는 것

기존 slate 계열 라이트 팔레트를 다크 팔레트로 직접 치환한다. 별도 CSS 변수/디자인 토큰 시스템을
새로 만들지 않고, 기존 코드 관례(인라인 Tailwind 클래스)를 그대로 따른다.

### 색상 매핑

| 용도 | 기존 (라이트) | 변경 (다크) |
|---|---|---|
| 페이지 배경 | `bg-slate-50` / `bg-white` | `bg-slate-950` |
| 카드/패널 표면 | `bg-white` | `bg-slate-900` |
| 구분선/테두리 | `border-slate-200`/`300` | `border-slate-800` |
| 본문 텍스트 | `text-slate-900`/`700` | `text-slate-50`/`200` |
| 보조/설명 텍스트 | `text-slate-500`/`400` | `text-slate-400` |
| placeholder/비활성 텍스트 | `text-slate-400` | `text-slate-600` |
| 인풋 필드 | `bg-white border-slate-300` | `bg-slate-900 border-slate-700` |
| 토글 pill 배경(비활성) | `bg-slate-100` | `bg-slate-800` |
| hover 배경 | `hover:bg-slate-50`/`100` | `hover:bg-slate-800` |
| 그림자로 분리감 주던 곳 | `shadow-sm` | 다크에서는 그림자 대신 `border border-slate-800`로 분리감 확보 |
| CTA/포인트 그라디언트 (`orange-400→pink-500`) | 유지 | **그대로 유지** |
| 태그 카드 그라디언트 (`TAG_GRADIENTS`, `tagColors.ts`) | 유지 | **그대로 유지** — 이미 흰 텍스트 위주라 다크 배경에 그대로 맞음 |
| 음성 녹음 화면 배경 | `from-orange-100 via-rose-100 to-pink-200` (라이트라서 낮춘 파스텔 톤) | `from-orange-500 via-rose-500 to-pink-600`류로 **원래 진한 톤 복원** — 파형/텍스트 대비도 원래 흰 글씨 기준으로 되돌림 |

### 적용 범위 (파일)

- `src/pages/LoginPage.tsx`
- `src/pages/RecordPage.tsx` (choice / 타이핑 / 녹음 3단계 전부)
- `src/pages/EntriesPage.tsx` (목록, 필터/정렬 UI, 선택모드 그리드)
- `src/pages/EntryDetailPage.tsx`
- `src/pages/InsightsPage.tsx`
- `src/components/CardStackCarousel.tsx`
- `src/components/EntryCardStack.tsx`
- `src/components/VoiceWaveform.tsx`
- `src/components/Logo.tsx` (배경 대비만 확인, 그라디언트 스트로크는 유지)
- `src/components/icons.tsx` (아이콘 stroke/fill이 `currentColor`가 아니라 고정 slate 값이면 다크에 맞게 조정)
- `src/index.css` — 다크 배경 기준 `color-scheme: dark` 등 브라우저 기본 UI(스크롤바, 폼 컨트롤) 대응 필요 시 추가

선택모드 그리드 카드(`design.md`가 "흰 배경 유지" 예외로 뒀던 부분)도 이번엔 `bg-slate-900`으로
맞춰 다크 톤을 통일한다 — 체크박스 자체의 선택/비선택 대비는 색(테두리·배경 밝기 차이)으로 유지.

## 이번에 안 하는 것

- 하단 nav바 구조 변경(홈/기록/내경험/패턴/내정보) — 별도 스펙
- "내경험" 탭 좌우 스와이프 컬렉션(프로젝트별 모아보기) — 별도 스펙
- 키워드 검색 + 태그 한 줄 배치 + 정렬/필터 토글 화면 신규 구현 — 별도 스펙
- 라이트/다크 토글 — 다크 단일 테마로 완전 전환하며 토글은 만들지 않는다
- 태그 그라디언트/CTA 그라디언트 색상표 자체 변경 (다크 배경에서도 그대로 재사용)
- 접근성 자동화 테스트 도입 (수동 확인만)

## 접근성

전환 후 실제 렌더링 기준으로 본문 텍스트 대비 4.5:1, UI 컴포넌트(테두리/토글 등) 대비 3:1(WCAG AA)을
브라우저 개발자도구 색상 대비 검사로 수동 확인한다. `text-slate-400 on bg-slate-950`,
`border-slate-800 on bg-slate-900` 등 실제 조합을 확인 대상으로 삼는다.

## 테스트/확인 방법

- `npm run build` 클린 통과
- `npm test` 기존 스위트 통과 (색상 클래스만 바뀌므로 로직 테스트에는 영향 없어야 함 — 스냅샷 테스트가
  있다면 갱신)
- 수동 확인: 모바일 뷰포트(375px) 기준으로 5개 페이지 전부 스크린샷, 그라디언트 카드/CTA가 다크
  배경 위에서 원래 의도대로 도드라져 보이는지, 인풋 포커스 상태·에러 배너·비활성 버튼 상태 대비 확인

## 확인할 것

- (해결됨) 다크 vs 라이트 유지 → 다크로 전환, Figma 우선.
- (해결됨) 음성 녹음 화면 배경 톤 → 원래 진한 그라디언트로 복원.
- (해결됨) 토글 지원 여부 → 안 함, 다크 단일 테마.
