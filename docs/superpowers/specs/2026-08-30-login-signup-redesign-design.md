# 로그인/가입 화면 + 기록 시작화면 리디자인 — 설계

날짜: 2026-08-30
관련: `design.md`(카드스택/녹음화면 그라디언트 토큰), `CLAUDE.md`

## 배경 / 범위

오늘 작업목록 5개 중 "로그인/가입" 관련 항목(2, 3번)을 첫 하위 프로젝트로 분리했다.
5개 항목 모두 서로 독립적인 화면/기능이라 하루에 한 번에 다루기엔 범위가 크므로,
각각 별도 스펙→플랜→구현 사이클로 진행하기로 사용자와 합의했다. 이번 스펙은 그중
로그인/가입 화면과, 사용자가 "로그인 직후 첫 진입점"으로 함께 지목한 `RecordPage`의
`choice` 단계(음성/타이핑 선택 화면)를 다룬다.

## 이번에 하는 것

1. `src/components/Logo.tsx` 신규 — echo 림플 아이콘 + "ECHO" 워드마크
2. `src/pages/LoginPage.tsx` 시각 리디자인 + 소셜 로그인 버튼(Google/Kakao) UI 추가
3. `src/pages/RecordPage.tsx`의 `step === 'choice'` 화면 시각 리디자인

## 이번에 안 하는 것

- 랜딩페이지, 레퍼런스 이미지 전체 적용, 기록/내경험 리스트 UX 개선 (오늘 목록의 다른 항목 — 별도 스펙)
- 실제 Google/Kakao OAuth 연동 완료. Supabase 프로젝트에 OAuth provider(클라이언트 ID/시크릿)를
  등록하는 건 사용자 계정에 종속된 콘솔 작업이라 이번 스코프에서 제외한다. 대신:
  - 버튼 클릭 시 `supabase.auth.signInWithOAuth({ provider: 'google' | 'kakao' })`를 실제로 호출하는
    코드는 작성한다 — provider 미등록 상태에서는 Supabase가 에러를 반환하고, 그 에러를 기존
    에러 메시지 영역에 그대로 표시한다.
  - provider 등록 절차는 이 스펙과 별도로 `docs/oauth-setup.md`(신규, 간단 가이드)에 정리해서
    사용자가 나중에 직접 따라할 수 있게 한다.
- `NavBar`에 로고 삽입 (범위 밖 — 필요하면 다음 세션에 별도로).
- 회원가입 시 이메일/비밀번호 검증 로직 변경 (기존 로직 그대로, 레이아웃만 수정).

## 로고 (`src/components/Logo.tsx`)

- SVG: 중심 점(●) + 2줄 동심 아크(echo 림플). 스트로크에
  `orange-400 → pink-500` 그라디언트(기존 녹음 화면 팔레트 재사용, 새 색 추가 안 함) 적용.
- Props: `size?: 'icon' | 'full'` — `icon`은 SVG만, `full`은 SVG + "ECHO" 워드마크(Pretendard bold)를
  가로로 배치. 픽셀 크기는 `className`으로 호출부에서 조정 가능하게 `width/height`를 상속.
- 이번 스코프에서 쓰는 곳: `LoginPage` 상단, `RecordPage` choice 화면 상단. 그 외 재사용은 후속 과제.

## 로그인/가입 화면 (`LoginPage.tsx`)

- **배경**: 계속 `bg-slate-50` 라이트 유지. `design.md`가 명시한 "그라디언트는 카드스택+녹음화면
  두 곳에만" 원칙을 그대로 따르고, 로그인 화면은 그 원칙대로 미니멀 유지 — 로고/버튼에만 그라디언트
  포인트를 준다.
- **탭 전환**: 로그인/회원가입 전환을 현재의 텍스트 링크 대신 pill 세그먼트 토글로 교체
  (`rounded-full bg-slate-100`, 활성 탭만 `bg-white shadow-sm`).
- **소셜 로그인 버튼**: 이메일 폼 위(또는 아래, 구현 시 결정) "또는" 구분선과 함께 Google/Kakao
  버튼 2개. 각 브랜드 아이콘은 간단한 인라인 SVG(공식 로고 색 사용 — Google 4색, Kakao 노랑+검정),
  텍스트는 "Google로 계속하기" / "카카오로 계속하기". `onClick`은 `supabase.auth.signInWithOAuth`
  직접 호출.
  - 버튼 아래 작은 안내 문구: "소셜 로그인은 설정 완료 후 사용할 수 있어요." (톤 낮은 `text-slate-400`)
- **폼 영역**: 기존 로직(로그인/가입 분기, 이메일 확인 대기 화면 등) 그대로, spacing/라벨/버튼
  스타일만 다듬는다. 제출 버튼은 그라디언트(`from-orange-400 to-pink-500`) 필 버튼으로 강조.
- **에러 표시**: 기존 에러 배너 컴포넌트 위치 그대로 재사용 — 소셜 로그인 에러도 같은 영역에 뜬다.

## 기록 시작화면 (`RecordPage.tsx` — `step === 'choice'`)

- 상단에 `Logo` (`size="full"`) 배치, 기존 타이틀/설명 문구는 그 아래 유지.
- "음성으로 기록" / "타이핑으로 기록" 버튼을 현재의 단순 테두리 박스에서, 좌측에 원형 그라디언트
  아이콘 배지를 얹은 카드 형태로 교체:
  - 음성: `from-orange-400 to-pink-500` 배지 + 마이크 아이콘(기존 `MicIcon` 재사용)
  - 타이핑: `slate-700` 단색 배지 + 펜/텍스트 아이콘(신규 또는 `icons.tsx`에 추가)
  - 카드 자체는 배경 흰색 유지, 배지만 컬러 — 화면 전체가 카드스택/녹음화면처럼 그라디언트로
    덮이지는 않는다(그 원칙은 `step === 'voice'` 화면에만 적용된 채 유지).
- 하단 큰 원형 마이크 버튼: 기존 슬레이트 테두리 대신 그라디언트 링(`ring-2 ring-offset-2` +
  그라디언트 보더) 추가로 브랜드 톤 예고.
- 접근성 disabled 상태(음성 미지원 브라우저) 스타일은 기존 로직 그대로 유지.

## 신규 파일: `docs/oauth-setup.md`

Google/Kakao OAuth를 Supabase에 등록하는 절차를 사용자가 따라할 수 있도록 정리:
1. Google Cloud Console에서 OAuth 클라이언트 생성 → Supabase Auth 설정에 Client ID/Secret 등록,
   redirect URI 확인.
2. Kakao Developers에서 앱 생성 → REST API 키 발급 → Supabase Auth의 Kakao provider(OAuth
   provider 목록에 있음)에 등록.
3. 등록 후 이 스펙에서 작성한 버튼이 별도 코드 수정 없이 바로 동작함을 명시.

## 테스트/확인 방법

- `npm run build` 클린, `npm test` 통과 (기존 테스트 스위트 — 새 로직이 거의 없어 신규 테스트는
  최소화하되, 소셜 로그인 버튼 클릭 시 `signInWithOAuth`가 올바른 provider 인자로 호출되는지만
  단위 테스트 1~2개 추가).
- 수동 확인: 로그인/가입 탭 전환, 이메일 가입 플로우(기존 동작 유지 확인), 소셜 버튼 클릭 시
  에러 배너 노출, RecordPage choice 화면 레이아웃(모바일 뷰포트 375px 기준).

## 확인할 것

- (해결됨) OAuth 실제 연동 여부 → UI만, 연동은 다음으로.
- (해결됨) 로고 컨셉 → echo 림플 아이콘 + 워드마크.
- (해결됨) 시작화면 범위 → 로그인 + RecordPage choice 단계 모두.
