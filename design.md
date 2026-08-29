# ECHO 디자인 시스템 (v2 — 폰트 + 카드 캐러셀 + 음성 녹음 화면)

## 타이포그래피

- **Pretendard v1.3.9** ([orioncactus/pretendard](https://github.com/orioncactus/pretendard/releases/tag/v1.3.9))를
  앱 전체 기본 폰트로 적용. `public/fonts/pretendard/`에 dynamic-subset 빌드(`woff2-dynamic-subset` +
  `pretendardvariable-dynamic-subset.css`)를 그대로 복사해두고 `index.html`에서 `<link>`로 로드한다 —
  실제 쓰는 글자의 유니코드 서브셋만 내려받아서(체감상 몇십 KB 단위) 무거운 로케일 미포함 파일을
  통째로 받지 않는다.
- `src/index.css`의 Tailwind v4 `@theme` 블록에서 `--font-sans`를 `'Pretendard Variable', Pretendard, ...`로
  재정의하고 `body`에 명시적으로 적용 — Tailwind v4의 프리플라이트가 `--font-sans`를 기본값으로 쓰는
  동작에 기대는 동시에, 명시적으로도 한 번 더 못박아둔다.

## 카드 캐러셀 (Vertical Stacked Card Carousel)

`ref.jpg`/`cardscroll.jpg` 스타일의 "화면 중앙에 가까운 카드가 확대·선명해지고 멀어질수록 작아지며
겹쳐 보이는" cover-flow 인터랙션. 이전 버전(탭하면 그 카드만 펼쳐지는 방식)은 폐기하고, 스크롤 위치
기반의 연속적인 scale/opacity/blur 애니메이션으로 교체했다.

- **범용 컴포넌트**: `src/components/CardStackCarousel.tsx` — `items`/`renderItem`/`getKey`/`maxVisible`/
  `activeIndex`/`onActiveChange`/`cardHeight`/`overlap` props를 받는 제네릭 컴포넌트. 엔트리에 종속되지
  않아 다른 데이터로도 재사용 가능.
- **엔트리 어댑터**: `src/components/EntryCardStack.tsx` — 위 컴포넌트를 감싸서 그라디언트 카드
  렌더링(`TAG_GRADIENTS`)만 얹는다. `EntriesPage`는 이 어댑터를 그대로 쓴다.
- **스크롤/스냅**: 커스텀 물리 엔진 대신 실제 `overflow-y: auto` + 네이티브 CSS
  `scroll-snap-type: y mandatory`를 쓴다 — 마우스 휠/터치 스와이프/모멘텀이 전부 브라우저가
  기본 제공하는 것이라 별도 구현이 필요 없고, 가볍고 안정적이다. 스크롤바는 숨김.
- **activeIndex 계산**: DOM을 매 프레임 읽는 대신, `스크롤 위치 → 카드 간격(step)으로 나눈 순수 산술`로
  각 카드의 "중앙까지의 거리"를 구한다(요청된 "IntersectionObserver 또는 거리 계산" 중 후자 방식).
  카드가 수백 개로 늘어나도 계산 비용이 늘지 않는다.
- **가상화**: 활성 카드 기준 ±5칸 밖의 카드는 아예 렌더링하지 않고, 위아래에 빈 스페이서로 스크롤
  높이만 유지한다 — 카드 개수가 아무리 많아져도 DOM 노드 수는 항상 일정하다.
- **거리별 스타일**: `scale = 1 - 0.04*|d|`, `opacity = 1 - 0.22*|d|`, `blur = max(0, (|d|-0.4)*1.4)px`,
  `z-index = 1000 - round(|d|*10)` (요청된 예시 수치와 동일한 계단: 1칸 0.96, 2칸 0.92, 3칸 0.88).
- **탭 동작**: active가 아닌 카드를 탭하면 캡처 단계에서 클릭을 가로채 "그 카드를 중앙으로 스크롤"만
  하고 내부 링크 이동은 막는다. 이미 중앙(active)인 카드를 탭하면 정상적으로 상세 화면으로 이동한다.

## 컬러 토큰

참고 이미지: `ref.jpg`(iOS 위젯형 카드 스택), `녹화탭.jpg`(따뜻한 그라디언트 음성 녹음 화면).
전체 앱 리디자인이 아니라 **아래 두 화면에만** 이 토큰을 적용한다. 로그인/기록 선택·타이핑/저장정보/
목록 필터·정렬/기록 상세 등 나머지 화면은 기존 slate 톤 미니멀 스타일을 그대로 유지한다.

## 원칙

- 기존 태그 시스템(`협업/갈등/주도성/실패/성취/문제해결` 6종, `tagColors.ts`)을 색의 근거로 삼는다.
  `ref.jpg`처럼 위젯마다 자의적인 색을 쓰지 않고, **엔트리의 첫 번째 태그가 카드의 그라디언트를 결정**한다.
  태그가 없으면 중립 그레이 그라디언트.
- 나머지 앱 크롬(네비게이션, 폼, 버튼)은 다크모드로 바꾸지 않는다. `ref.jpg`는 다크 배경이지만,
  ECHO는 라이트 배경 위에 카드 자체만 화려한 그라디언트로 떠 있는 형태로 가져간다 (iOS 위젯이
  라이트 홈스크린 위에서도 화려하게 보이는 것과 동일한 논리).

## 컬러 토큰

### 태그별 카드 그라디언트 (`TAG_GRADIENTS`, `src/lib/tagColors.ts`)

| 태그 | 그라디언트 | 근거 |
|---|---|---|
| 협업 | `from-sky-500 to-blue-600` | 기존 파랑 계열 유지, 채도만 올림 |
| 갈등 | `from-rose-500 to-red-600` | 기존 빨강 계열 |
| 주도성 | `from-amber-400 to-orange-500` | 기존 앰버 계열 |
| 실패 | `from-slate-600 to-slate-800` | 유일하게 무채색 — "실패"를 축하하는 톤으로 보이지 않게 의도적으로 차분하게 유지 |
| 성취 | `from-emerald-400 to-green-600` | 기존 초록 계열 |
| 문제해결 | `from-violet-500 to-purple-600` | 기존 보라 계열 |
| (태그 없음) | `from-slate-400 to-slate-500` | 중립 폴백 |

### 음성 녹음 화면 배경 (`녹화탭.jpg` 참고)

- 배경: `bg-gradient-to-b from-orange-100 via-rose-100 to-pink-200` (라이트 톤 — 원본은 더 진하지만
  ECHO 앱 전체가 라이트 배경이라 톤을 낮춤)
- 중앙 마이크 버튼: `bg-gradient-to-br from-orange-400 to-pink-500`, 원형, `shadow-lg`
- 파형 막대: 배경이 밝아졌으므로 원본(흰 막대)과 달리 대비를 위해 `bg-white/90` + `shadow-sm`
- 텍스트: 원본은 옅은 배경 위 흰 글씨지만, 우리 배경이 더 밝기 때문에 가독성을 위해
  `text-slate-700`/`text-slate-900` 유지 (원본 그대로 흰 글씨를 쓰면 밝은 배경에서 대비 부족)

## 카드 스택 스펙 (`src/components/EntryCardStack.tsx`)

`ref.jpg`의 "겹쳐진 카드 중 하나만 크게 펼쳐지는" 구조를 그대로 따르되, 색은 태그 그라디언트로:

- 모서리: `rounded-3xl` (기존 `rounded-lg`보다 훨씬 둥글게 — 원본의 부드러운 느낌)
- 겹침: 접힌 카드는 `-mt-11`(44px)로 이전 카드 위에 포개짐, 원본처럼 촘촘한 스택감
- 접힌 카드: 그라디언트 배경 + `text-white font-bold`, 제목 한 줄만 (padding `px-5 py-4`)
- 펼쳐진 카드: 같은 그라디언트가 이어지며 `p-5`로 확장, 흰색/반투명 흰색 텍스트 계층
  (제목 `text-white`, 본문 `text-white/90`, 날짜 `text-white/70`)
- 태그 배지(펼쳐진 카드 내부): 그라디언트 위에서 기존 `TAG_COLORS` 파스텔 배지는 대비가 안 나오므로
  `bg-white/20 text-white` 유리질(glass) 배지로 교체
- "상세 보기" 버튼: `bg-white text-slate-900` 필(pill) 버튼 — 그라디언트 위에서 가장 눈에 띄는 대비
- 그림자: `shadow-lg shadow-black/10`로 겹친 카드 사이 분리감 확보 (원본은 어두운 배경이라 그림자가
  거의 안 보이지만, 우리는 라이트 배경이라 그림자가 분리 신호로 필요)

## 적용 범위 밖 (이번에 안 함)

- 로그인/기록 화면(선택·타이핑·저장정보)/목록 상단 필터·정렬 UI/기록 상세/패턴 화면의 색상 체계
- 다크모드 전환
- 선택 모드(다중 선택) 그리드 카드 — 기존 흰 배경 + 체크 UI 그대로 유지 (그라디언트 카드에 체크박스를
  얹으면 선택 상태 대비가 애매해지므로, 선택 모드는 기존 스타일 유지)
