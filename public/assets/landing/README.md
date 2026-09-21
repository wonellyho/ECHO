# 랜딩페이지 이미지

랜딩(`/`)에서 쓰는 이미지를 여기 모은다. 참조 경로는 항상 `/assets/landing/파일명`.

현재 랜딩은 **이미지 없이도 완성된 상태로 동작한다.** 폰 목업 안에는 스크린샷 PNG가 아니라
실제 앱 컴포넌트(`src/components/landing/AppScreens.tsx`)가 그대로 렌더되고, 기기 프레임도
CSS로 그린다(`src/components/landing/PhoneMockup.tsx`). 아래 파일들은 "나중에 갈아끼우고
싶을 때" 쓰는 선택 슬롯이다.

---

## 1) og-image.png — 공유 미리보기 (유일한 필수 항목)

- 규격: **1200 × 630 PNG**
- 쓰는 곳: `index.html`의 `og:image` / `twitter:image`
- 없으면: 카카오톡·슬랙 등에 링크를 붙였을 때 썸네일이 안 뜬다. 그 외 랜딩 동작에는 영향 없음.
- 추천: 랜딩 히어로(별자리 폰 목업 + 메인 카피)를 그대로 캡처

## 2) 앱 스크린샷으로 갈아끼우기 (선택)

폰 목업 안을 실제 스크린샷 이미지로 바꾸고 싶을 때.

- 규격: **393 × 852 px** (iPhone 15 Pro 논리 해상도) 또는 그 2배수, WebP 권장
- 파일명 예시
  - `screen-record.webp` — 기록 홈
  - `screen-voice.webp` — 음성 기록 중
  - `screen-structured.webp` — AI 구조화 결과
  - `screen-constellation.webp` — 별자리
  - `screen-starwl.webp` — STARWL 경험 카드
- 적용: `src/components/landing/AppScreens.tsx`의 `SHOWCASE_SCREENS` 각 항목에
  `screenshot: '/assets/landing/screen-record.webp'` 를 추가하면 그 화면만 이미지로 바뀐다.
  (`PhoneMockup`의 `screenSrc` prop으로 전달된다.)

## 3) 실사 3D 기기 목업으로 갈아끼우기 (선택)

CSS 프레임 대신 렌더링된 iPhone 목업 PNG를 쓰고 싶을 때.

- 규격: **배경이 투명한 PNG/WebP**, 기기 전체가 들어가고 화면 영역이 비어 있어야 한다
- 파일명 예시: `iphone-15-pro.png`
- 적용:
  ```tsx
  <PhoneMockup
    frameSrc="/assets/landing/iphone-15-pro.png"
    frameScreenInset={{ top: 1.6, right: 2.7, bottom: 1.6, left: 2.7 }}
  >
    <ConstellationScreen />
  </PhoneMockup>
  ```
  `frameScreenInset`은 목업 이미지 안에서 **화면 영역이 차지하는 비율(%)** 이다.
  목업마다 다르므로 한 번 넣어보고 맞춰야 한다.

> 참고: Figma 커뮤니티 파일(iPhone 15 Pro 3D Mockups)은 본인 계정으로 **Duplicate** 해야
> 열 수 있다. 복제한 뒤 투명 배경 PNG로 export 해서 여기 넣으면 된다.
