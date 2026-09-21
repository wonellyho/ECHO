# 앱 전체 다크 테마 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ECHO 앱의 모든 화면(로그인/기록/내경험/상세/패턴)을 라이트 slate 팔레트에서 다크 slate 팔레트로 전환한다. 그라디언트 포인트(태그 카드, CTA, 로고)는 그대로 유지한다.

**Architecture:** 새 CSS 변수/토큰 시스템을 만들지 않고, 기존 코드 관례대로 각 파일의 Tailwind 클래스 문자열을 다크 팔레트 값으로 직접 치환한다. 순수 시각적(클래스명) 변경이라 컴포넌트 로직·props·상태는 건드리지 않는다.

**Tech Stack:** React + TypeScript + Tailwind CSS v4 (Vite). 테스트: Vitest (`npm test`), 빌드 검증: `npm run build` (`tsc -b && vite build`).

## Global Constraints

- 별도 다크/라이트 토글은 만들지 않는다 — 다크 단일 테마로 완전 전환.
- 태그 카드 그라디언트(`TAG_GRADIENTS`, `tagColors.ts`)와 CTA 그라디언트(`from-orange-400 to-pink-500`)는 색상 자체를 변경하지 않는다.
- 순수 클래스명 변경이므로 각 태스크에 새 단위 테스트를 추가하지 않는다 — 기존 `npm test` 스위트(색상과 무관한 로직 테스트만 존재, `src/lib/*.test.ts`)가 각 태스크 후에도 그대로 통과해야 하고, 매 태스크의 검증은 `npm run build` 클린 통과 + 수동 시각 확인이다.
- 색상 매핑은 `docs/superpowers/specs/2026-08-30-dark-theme-conversion-design.md`의 표를 그대로 따른다 (페이지 배경 `slate-950`, 카드 표면 `slate-900`, 테두리 `slate-800`, 본문 텍스트 `slate-50`/`200`, 보조 텍스트 `slate-400`, placeholder `slate-600`).
- 에러 텍스트는 앱 전체에서 `text-red-600` → `text-red-400`으로 통일한다 (다크 배경 대비 확보).

---

### Task 1: 태그 배지 다크 팔레트 (`src/lib/tagColors.ts`)

**Files:**
- Modify: `src/lib/tagColors.ts:7-14`

**Interfaces:**
- Consumes: 없음 (독립 상수 파일)
- Produces: `TAG_COLORS`가 `EntriesPage.tsx`/`EntryDetailPage.tsx`의 필터/태그 배지에서 그대로 사용됨 — export 이름과 `Record<ExperienceTag, string>` 타입은 변경하지 않는다.

- [ ] **Step 1: `TAG_COLORS`의 파스텔 배지를 다크 배경용 반투명 배지로 교체**

`src/lib/tagColors.ts`의 7~14번째 줄을 다음으로 교체:

```ts
export const TAG_COLORS: Record<ExperienceTag, string> = {
  협업: 'bg-blue-500/15 text-blue-300',
  갈등: 'bg-red-500/15 text-red-300',
  주도성: 'bg-amber-500/15 text-amber-300',
  실패: 'bg-slate-500/20 text-slate-300',
  성취: 'bg-green-500/15 text-green-300',
  문제해결: 'bg-violet-500/15 text-violet-300',
};
```

`TAG_COLORS_ACTIVE`(16~23줄)와 `TAG_GRADIENTS`(29~36줄), `NEUTRAL_CARD_GRADIENT`(38줄)는 변경하지 않는다 — 이미 진한 배경/흰 텍스트라 다크 배경에 그대로 맞는다.

- [ ] **Step 2: 빌드로 타입/문법 확인**

Run: `npm run build`
Expected: 에러 없이 통과 (색상 문자열만 바뀌었으므로 타입에는 영향 없음)

- [ ] **Step 3: 커밋**

```bash
git add src/lib/tagColors.ts
git commit -m "style: dark-mode tag badge colors"
```

---

### Task 2: 앱 셸 다크 베이스 (`index.css`, `App.tsx`, `Logo.tsx`)

**Files:**
- Modify: `src/index.css`
- Modify: `src/App.tsx:10-81`
- Modify: `src/components/Logo.tsx:49`

**Interfaces:**
- Consumes: 없음
- Produces: `body`의 기본 배경/텍스트 색, `NavBar`의 다크 스타일, 인증 후 루트 래퍼(`min-h-screen`)의 다크 배경 — 이후 모든 페이지 태스크가 이 배경 위에서 검증된다.

- [ ] **Step 1: `index.css`에 다크 배경/텍스트 기본값 추가**

`src/index.css` 전체를 다음으로 교체:

```css
@import "tailwindcss";

@theme {
  --font-sans:
    'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto,
    'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
}

body {
  font-family: var(--font-sans);
  background-color: #020617; /* slate-950 */
  color: #f8fafc; /* slate-50 */
  color-scheme: dark;
}
```

- [ ] **Step 2: `App.tsx`의 `NavBar`와 루트 래퍼를 다크로 전환**

`src/App.tsx:13-16`을 교체:

```tsx
  const linkClass = (active: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      active ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-900'
    }`;
```

`src/App.tsx:19`을 교체:

```tsx
    <nav className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-800 bg-slate-950 p-2">
```

`src/App.tsx:44`를 교체:

```tsx
        className="ml-auto rounded-md px-3 py-2 text-sm text-slate-500 hover:text-slate-300"
```

`src/App.tsx:56`을 교체 (로딩 상태도 다크로):

```tsx
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">불러오는 중...</div>;
```

`src/App.tsx:68`을 교체:

```tsx
    <div className="min-h-screen bg-slate-950">
```

- [ ] **Step 3: `Logo.tsx`의 워드마크 텍스트 색 전환**

`src/components/Logo.tsx:49`를 교체:

```tsx
      <span className="text-2xl font-bold tracking-tight text-slate-50">ECHO</span>
```

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 통과

- [ ] **Step 5: 수동 확인**

`npm run dev`로 실행 후 로그인 화면(비인증 상태)과 로그인 후 상단 nav바가 다크 배경으로 보이는지 확인. (로그인 화면 자체의 남은 라이트 색상은 Task 3에서 처리하므로 이번 단계에서는 배경/셸만 확인)

- [ ] **Step 6: 커밋**

```bash
git add src/index.css src/App.tsx src/components/Logo.tsx
git commit -m "style: dark theme app shell (index.css, NavBar, Logo)"
```

---

### Task 3: 로그인/가입 화면 (`src/pages/LoginPage.tsx`)

**Files:**
- Modify: `src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `Logo`(Task 2에서 다크 전환됨), `GoogleIcon`/`KakaoIcon`(변경 없음)
- Produces: 없음 (leaf 페이지)

- [ ] **Step 1: 이메일 확인 대기 화면(82~104줄) 다크 전환**

`src/pages/LoginPage.tsx:84`를 교체:

```tsx
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-slate-950 px-4 py-6">
```

`86번째 줄`을 교체:

```tsx
        <p className="mt-1 text-sm text-slate-400">경험을 기록하고, 나를 발견하다.</p>
```

`88번째 줄`을 교체:

```tsx
        <div className="mt-6 rounded-md border border-slate-700 p-3 text-sm text-slate-200">
```

`92번째 줄`을 교체:

```tsx
          <p className="mt-1 text-slate-400">메일의 링크를 눌러 인증을 완료하면 로그인할 수 있어요.</p>
```

`95~101번째 줄`의 버튼 className을 교체:

```tsx
          className="mt-4 w-full rounded-md border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
```

- [ ] **Step 2: 메인 로그인/가입 폼(106~211줄) 다크 전환**

`107번째 줄`을 교체:

```tsx
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-slate-950 px-4 py-6">
```

`109번째 줄`을 교체:

```tsx
      <p className="mt-1 text-sm text-slate-400">경험을 기록하고, 나를 발견하다.</p>
```

`111번째 줄`을 교체:

```tsx
      <div className="mt-6 inline-flex rounded-full bg-slate-800 p-1 text-sm font-medium">
```

`112~121번째 줄`(로그인 탭 버튼)의 className 표현식을 교체:

```tsx
          className={`flex-1 rounded-full px-4 py-1.5 transition-colors ${
            mode === 'login' ? 'bg-slate-950 text-slate-50 shadow-sm' : 'text-slate-400'
          }`}
```

`122~131번째 줄`(회원가입 탭 버튼)의 className 표현식을 교체:

```tsx
          className={`flex-1 rounded-full px-4 py-1.5 transition-colors ${
            mode === 'signup' ? 'bg-slate-950 text-slate-50 shadow-sm' : 'text-slate-400'
          }`}
```

`135~142번째 줄`(이메일 인풋)의 className을 교체:

```tsx
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
```

`143~152번째 줄`(비밀번호 인풋)의 className을 동일하게 교체:

```tsx
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
```

`154~163번째 줄`(비밀번호 확인 인풋)의 className도 동일하게 교체:

```tsx
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
```

`165번째 줄`(에러 텍스트)을 교체:

```tsx
        {error && <p className="text-sm text-red-400">{error}</p>}
```

169번째 줄(제출 버튼)은 그대로 둔다 — CTA 그라디언트는 색 변경 없음.

`176번째, 178번째 줄`(구분선)을 교체:

```tsx
        <div className="h-px flex-1 bg-slate-800" />
```

(두 줄 모두 동일하게 `bg-slate-200` → `bg-slate-800`으로 교체)

`182~190번째 줄`(Google 버튼)의 className을 교체:

```tsx
          className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:opacity-50"
```

(Kakao 버튼 195번째 줄은 브랜드 색이므로 변경하지 않는다)

`206번째 줄`(모드 전환 링크)을 교체:

```tsx
        className="mt-4 text-center text-sm text-slate-400 hover:text-slate-200"
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 통과

- [ ] **Step 4: 수동 확인**

`npm run dev`로 로그인 화면 접속 (375px 뷰포트). 로그인/가입 탭 전환, 인풋 포커스, 소셜 버튼, 에러 배너(잘못된 비밀번호로 제출)가 다크 배경에서 잘 읽히는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/pages/LoginPage.tsx
git commit -m "style: dark theme LoginPage"
```

---

### Task 4: 기록 시작화면 — choice 단계 (`src/pages/RecordPage.tsx`)

**Files:**
- Modify: `src/pages/RecordPage.tsx:269-329`

**Interfaces:**
- Consumes: `Logo`(Task 2에서 다크 전환됨)
- Produces: 없음

- [ ] **Step 1: choice 단계 다크 전환**

`273번째 줄`을 교체:

```tsx
        <h2 className="mt-6 text-xl font-semibold text-slate-50">오늘의 경험을 남겨보세요</h2>
```

`274번째 줄`을 교체:

```tsx
        <p className="mt-2 text-sm text-slate-400">말하거나 적으면 AI가 구조화해 둡니다.</p>
```

`277~281번째 줄`(음성 버튼)의 className을 교체:

```tsx
            className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-left transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
```

`287번째 줄`을 교체:

```tsx
              <p className="text-sm font-semibold text-slate-50">음성으로 기록</p>
```

`288번째 줄`을 교체:

```tsx
              <p className="mt-0.5 text-xs text-slate-400">
```

`293~296번째 줄`(타이핑 버튼)의 className을 교체:

```tsx
            className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-left transition-colors hover:bg-slate-800"
```

`302번째 줄`을 교체:

```tsx
              <p className="text-sm font-semibold text-slate-50">타이핑으로 기록</p>
```

`303번째 줄`을 교체:

```tsx
              <p className="mt-0.5 text-xs text-slate-400">직접 입력합니다</p>
```

`309번째 줄`(음성 미지원 안내)을 교체:

```tsx
          <p className="mt-3 rounded-md border border-slate-700 p-2.5 text-xs text-slate-200">
```

`315번째 줄`을 교체:

```tsx
          <p className="text-xs text-slate-400">눌러서 바로 녹음 시작</p>
```

321~326번째 줄(마이크 버튼)은 그대로 둔다 — 그라디언트/내부 원 색은 배경과 무관하게 이미 성립.

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 통과

- [ ] **Step 3: 수동 확인**

`npm run dev` → 로그인 후 기록 시작화면(`/`)에서 음성/타이핑 카드 대비, 하단 마이크 버튼이 잘 보이는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/pages/RecordPage.tsx
git commit -m "style: dark theme RecordPage choice step"
```

---

### Task 5: 음성 녹음화면 — voice 단계 (`src/pages/RecordPage.tsx`)

**Files:**
- Modify: `src/pages/RecordPage.tsx:332-408`

**Interfaces:**
- Consumes: `VoiceWaveform`(변경 없음, `barClassName="bg-white/90"`는 이미 이 화면 전용 오버라이드)
- Produces: 없음

design.md 원칙: 이 화면은 원래 진한 그라디언트였다가 "앱이 라이트라서" 파스텔로 낮췄던 것을 이번에 원복한다. 글래스(반투명 흰색) 요소들은 그대로 두고, 그라디언트 위에 직접 얹힌 텍스트만 흰 계열로 바꾼다.

- [ ] **Step 1: 배경 그라디언트를 진한 톤으로 복원**

`334번째 줄`을 교체:

```tsx
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col bg-gradient-to-b from-orange-500 via-rose-500 to-pink-600 px-4 py-6">
```

- [ ] **Step 2: 그라디언트 위에 직접 놓인 텍스트를 흰 계열로 전환 (글래스 요소는 유지)**

`343번째 줄`을 교체:

```tsx
          <p className="font-medium text-white">
```

`353번째 줄`을 교체:

```tsx
        <p className="mt-6 min-h-[3.5rem] whitespace-pre-wrap text-center text-sm leading-relaxed text-white/90">
```

`366번째 줄`을 교체:

```tsx
        {micLevel.error && <p className="mt-2 text-xs text-white/80">{micLevel.error} (파형만 비활성됩니다)</p>}
```

`406번째 줄`을 교체:

```tsx
        <p className="mt-2 text-center text-xs text-white/70">가운데 버튼 = 녹음 정지 · 정지하면 저장 정보 입력으로</p>
```

다음 요소들은 `bg-white/50`/`border-white/60` 글래스 배경 위에 있어 배경이 진해져도 그대로 읽히므로 **변경하지 않는다**: 339번째 줄(뒤로 버튼), 359~364번째 줄(음성 인식 실패 카드), 373번째 줄(키보드 전환 버튼), 397~404번째 줄(취소 버튼).

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 통과

- [ ] **Step 4: 수동 확인**

`npm run dev` → 음성으로 기록 시작 → 배경이 진한 오렌지→핑크 그라디언트로 보이는지, 트랜스크립트 텍스트와 안내문이 흰 글씨로 잘 읽히는지, 글래스 버튼(뒤로/키보드/취소)이 여전히 잘 보이는지 확인. 브라우저가 음성 인식을 지원하지 않으면 이 화면 진입이 막히므로 Chrome에서 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/pages/RecordPage.tsx
git commit -m "style: restore vivid gradient on RecordPage voice step"
```

---

### Task 6: 타이핑/저장정보 단계 (`src/pages/RecordPage.tsx`)

**Files:**
- Modify: `src/pages/RecordPage.tsx:411-561`

**Interfaces:**
- Consumes: 없음
- Produces: 없음

- [ ] **Step 1: typing 단계(411~431줄) 다크 전환**

`414번째 줄`을 교체:

```tsx
        <h2 className="text-xl font-semibold text-slate-50">오늘의 경험을 남겨보세요</h2>
```

`415~420번째 줄`(textarea)의 className을 교체:

```tsx
          className="mt-4 w-full rounded-md border border-slate-700 bg-slate-900 p-3 text-sm text-slate-50 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
```

426번째 줄(다음 버튼)은 그대로 둔다 — `bg-slate-900 text-white`는 다크 배경 위에서도 표면 구분이 되는 패턴으로 앱 전체에서 재사용.

- [ ] **Step 2: details 단계(435~561줄) 다크 전환**

`442번째 줄`(뒤로 버튼)을 교체:

```tsx
          className="rounded-md border border-slate-700 px-3 py-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
```

`446번째 줄`을 교체:

```tsx
        <p className="font-medium text-slate-50">2 / 2 · 저장 정보</p>
```

`450번째 줄`을 교체:

```tsx
      <div className="mt-4 rounded-md border border-slate-700 bg-slate-900 p-3">
```

`451번째 줄`을 교체:

```tsx
        <p className="text-xs text-slate-400">{source === 'voice' ? '녹음한 내용' : '입력한 내용'}</p>
```

`453~458번째 줄`(내용 수정 textarea)의 className을 교체:

```tsx
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-sm text-slate-50"
```

`460번째 줄`을 교체:

```tsx
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{content}</p>
```

`462~466번째 줄`(내용 수정 버튼)을 교체:

```tsx
          className="mt-2 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
```

`472번째 줄`을 교체:

```tsx
        <p className="text-sm font-semibold text-slate-50">프로젝트 제목</p>
```

`473~480번째 줄`(프로젝트 제목 인풋)의 className을 교체:

```tsx
          className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none disabled:opacity-50"
```

`488번째 줄`을 교체:

```tsx
          <p className="mt-1.5 text-xs text-slate-400">추천할 기존 제목이 없습니다</p>
```

`493번째 줄`을 교체:

```tsx
        <p className="text-sm font-semibold text-slate-50">컬렉션</p>
```

`495번째 줄`(빈 컬렉션 안내)을 교체:

```tsx
          <p className="mt-1.5 rounded-md border border-dashed border-slate-700 p-3 text-center text-xs text-slate-400">
```

`499~503번째 줄`(컬렉션 select)의 className을 교체:

```tsx
          className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:border-slate-500 focus:outline-none disabled:opacity-50"
```

`514~520번째 줄`(새 컬렉션 이름 인풋)의 className을 교체:

```tsx
            className="mt-2 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none disabled:opacity-50"
```

`525번째 줄`을 교체:

```tsx
      {statusMessage && <p className="mt-4 text-sm text-slate-400">{statusMessage}</p>}
```

`526~529번째 줄`(에러 박스)을 교체:

```tsx
        <div className="mt-4 rounded-md border border-slate-700 bg-slate-900 p-2.5 text-sm text-slate-100">
          <p>! {error}</p>
          {structureFailed && <p className="mt-1 text-xs text-slate-400">기록 자체는 저장됨 · 구조화만 재시도</p>}
```

`543~548번째 줄`(구조화 없이 저장 버튼)을 교체:

```tsx
            className="rounded-md border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
```

(535~541번째 줄의 다시 시도 버튼, 552~558번째 줄의 저장 버튼은 `bg-slate-900 text-white` 패턴 그대로 유지)

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 통과

- [ ] **Step 4: 수동 확인**

`npm run dev` → 타이핑으로 기록 → 저장 정보 화면까지 진행하며 인풋/select/에러 박스가 다크 배경에서 잘 읽히는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/pages/RecordPage.tsx
git commit -m "style: dark theme RecordPage typing and details steps"
```

---

### Task 7: 내 경험 목록 화면 (`src/pages/EntriesPage.tsx`)

**Files:**
- Modify: `src/pages/EntriesPage.tsx`

**Interfaces:**
- Consumes: `TAG_COLORS`/`TAG_COLORS_ACTIVE`(Task 1에서 다크 전환됨), `EntryCardStack`(변경 없음 — 그라디언트 카드는 그대로)
- Produces: 없음

- [ ] **Step 1: 카드 렌더 함수(191~237줄) 다크 전환**

`192번째 줄`(구분선 클래스)을 교체:

```tsx
    const dividerClass = selectMode && selectedIds.has(entry.id) ? 'border-white/20' : 'border-slate-800';
```

`214~216번째 줄`(선택모드 카드)의 className 표현식을 교체:

```tsx
          className={`relative flex h-44 flex-col overflow-hidden rounded-lg text-left transition-colors ${
            selected
              ? 'bg-gradient-to-br from-orange-500 to-pink-600 text-white'
              : 'bg-slate-900 text-slate-100 hover:bg-slate-800'
          }`}
```

`218~222번째 줄`(체크 표시)의 className 표현식을 교체:

```tsx
            className={`absolute right-2 top-2 h-4 w-4 rounded-full border-2 ${
              selected ? 'border-white bg-white' : 'border-slate-600'
            }`}
```

`232번째 줄`(비-선택모드 카드 — 현재 호출 경로 없는 fallback이지만 일관성을 위해 함께 전환)을 교체:

```tsx
        className="flex h-44 flex-col overflow-hidden rounded-lg bg-slate-900 text-slate-100 transition-shadow hover:shadow-md"
```

- [ ] **Step 2: 상단 헤더/검색/필터(239~307줄) 다크 전환**

`242번째 줄`을 교체:

```tsx
        <h2 className="text-xl font-semibold text-slate-50">내 경험 기록</h2>
```

`243~248번째 줄`(선택 버튼)을 교체:

```tsx
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
```

`252~257번째 줄`(검색 인풋)의 className을 교체:

```tsx
        className="mt-4 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
```

`276~281번째 줄`(정렬 토글 버튼)의 className을 교체:

```tsx
          className="flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
```

`286번째 줄`(정렬 드롭다운 패널)을 교체:

```tsx
          <div className="absolute left-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 py-1 shadow-lg">
```

`296~300번째 줄`(정렬 옵션 버튼)의 className 표현식을 교체:

```tsx
                className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                  sortMode === opt.value
                    ? 'bg-slate-700 font-medium text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
```

- [ ] **Step 3: 로딩/에러/빈 상태(309~350줄) 다크 전환**

`309번째 줄`을 교체:

```tsx
      {loading && <p className="mt-4 text-sm text-slate-400">불러오는 중...</p>}
```

`311~322번째 줄`(에러 박스)을 교체:

```tsx
        <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">
          <p className="text-slate-200">기록을 불러오지 못했습니다.</p>
          <button
            type="button"
            onClick={loadEntries}
            className="mt-2 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
```

`325번째 줄`을 교체:

```tsx
        <p className="mt-4 text-sm text-slate-400">기록이 없습니다.</p>
```

`339번째 줄`(그룹 라벨)을 교체:

```tsx
                <h3 className="text-sm font-semibold text-slate-300">{group.label}</h3>
```

- [ ] **Step 4: 하단 일괄 작업 바(352~389줄) 다크 전환**

`353번째 줄`을 교체:

```tsx
        <div className="fixed inset-x-0 bottom-0 flex flex-col gap-2 border-t border-slate-800 bg-slate-900 p-3">
```

`354번째 줄`을 교체:

```tsx
          <p className="text-xs text-slate-400">{selectedIds.size}개 선택됨</p>
```

`356~360번째 줄`(컬렉션 select)의 className을 교체:

```tsx
              className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-50"
```

`369~373번째 줄`(추가 버튼)의 className을 교체:

```tsx
              className="rounded-md bg-gradient-to-r from-orange-400 to-pink-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
```

`379~384번째 줄`(새 컬렉션 이름 인풋)의 className을 교체:

```tsx
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-50"
```

`387번째 줄`을 교체:

```tsx
          {bulkError && <p className="text-xs text-red-400">{bulkError}</p>}
```

- [ ] **Step 5: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 통과

- [ ] **Step 6: 수동 확인**

`npm run dev` → `/entries`에서 카드 스택(그라디언트, 변경 없음), 검색/태그/정렬 UI, "선택" 모드 진입 후 그리드 카드(선택/비선택 대비), 하단 일괄 작업 바가 다크 배경에서 잘 보이는지 확인.

- [ ] **Step 7: 커밋**

```bash
git add src/pages/EntriesPage.tsx
git commit -m "style: dark theme EntriesPage"
```

---

### Task 8: 기록 상세 화면 (`src/pages/EntryDetailPage.tsx`)

**Files:**
- Modify: `src/pages/EntryDetailPage.tsx`

**Interfaces:**
- Consumes: `TAG_COLORS`/`TAG_COLORS_ACTIVE`(Task 1에서 다크 전환됨)
- Produces: 없음

- [ ] **Step 1: 헤더/좌측 원문 패널(168~199줄) 다크 전환**

`169번째 줄`을 교체:

```tsx
      <h2 className="text-xl font-semibold text-slate-50">기록 상세</h2>
```

`172번째 줄`을 교체:

```tsx
        <div className="rounded-lg bg-slate-900 p-4 lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
```

`173번째 줄`을 교체:

```tsx
          <p className="whitespace-pre-wrap text-sm text-slate-100">{rawText}</p>
```

`175번째 줄`을 교체:

```tsx
            <p className="text-xs font-medium text-slate-400">
```

`197번째 줄`을 교체:

```tsx
            {tagError && <p className="mt-1.5 text-xs text-red-400">{tagError}</p>}
```

- [ ] **Step 2: 탭 헤더(201~232줄) 다크 전환**

`202번째 줄`을 교체:

```tsx
          <div className="flex gap-2 border-b border-slate-800">
```

`203~213번째 줄`(구조화 탭)의 className 표현식을 교체:

```tsx
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                tab === 'structure'
                  ? 'border-b-2 border-slate-50 text-slate-50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
```

`214~222번째 줄`(STARWL 탭)의 className 표현식을 교체:

```tsx
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                tab === 'starwl' ? 'border-b-2 border-slate-50 text-slate-50' : 'text-slate-400 hover:text-slate-200'
              }`}
```

`223~231번째 줄`(패턴 탭)의 className 표현식을 교체:

```tsx
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                tab === 'pattern'
                  ? 'border-b-2 border-slate-50 text-slate-50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
```

- [ ] **Step 3: 구조화 탭(234~291줄) 다크 전환**

`237번째 줄`을 교체:

```tsx
                <h3 className="text-sm font-medium text-slate-300">구조화 결과</h3>
```

`252번째 줄`(수정 버튼)을 교체:

```tsx
                      className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
```

`262번째 줄`(필드 카드)을 교체:

```tsx
                    <div key={key} className="rounded-lg bg-slate-900 p-3">
```

`263번째 줄`을 교체:

```tsx
                      <dt className="text-xs font-medium text-slate-400">{label}</dt>
```

`265~269번째 줄`(수정 textarea)의 className을 교체:

```tsx
                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-800 p-2 text-sm text-slate-50"
```

`272번째 줄`을 교체:

```tsx
                        <dd className="mt-1 text-sm text-slate-100">{structured[key] ?? '-'}</dd>
```

`278번째 줄`을 교체:

```tsx
                <p className="mt-2 text-sm text-slate-400">구조화 결과를 불러오는 중입니다...</p>
```

`289번째 줄`을 교체:

```tsx
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
```

(281~288번째 줄 STARWL 추출 버튼은 `bg-slate-900 text-white` 패턴 그대로 유지)

- [ ] **Step 4: STARWL 탭(293~308줄) 다크 전환**

`298번째 줄`(필드 카드)을 교체:

```tsx
                    <div key={key} className="rounded-lg bg-slate-900 p-3">
```

`299번째 줄`을 교체:

```tsx
                      <dt className="text-xs font-medium text-slate-400">{label}</dt>
```

`300번째 줄`을 교체:

```tsx
                      <dd className="mt-1 text-sm text-slate-100">{starwl[key] ?? '-'}</dd>
```

`305번째 줄`을 교체:

```tsx
                <p className="text-sm text-slate-400">아직 추출한 STARWL이 없습니다.</p>
```

- [ ] **Step 5: 패턴 탭(310~337줄) 다크 전환**

`313번째 줄`을 교체:

```tsx
                  이 기록과 관련된 패턴이 아직 없어요.{' '}
```

(이 줄 자체는 색상 클래스가 없으므로 그대로 두고, 아래 315번째 줄만 수정)

`315번째 줄`을 교체:

```tsx
                  <Link to="/insights" className="font-medium text-slate-50 underline">
```

`323~326번째 줄`(인사이트 카드)의 className 표현식을 교체:

```tsx
                      className={`rounded-lg border-l-4 p-3 ${
                        item.type === 'energizer' ? 'border-amber-400 bg-amber-500/10' : 'border-slate-400 bg-slate-500/10'
                      }`}
```

`328번째 줄`을 교체:

```tsx
                      <p className="text-xs font-medium text-slate-400">
```

`331번째 줄`을 교체:

```tsx
                      <p className="mt-1 text-sm text-slate-100">{item.summary}</p>
```

- [ ] **Step 6: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 통과

- [ ] **Step 7: 수동 확인**

`npm run dev` → 아무 기록 상세(`/entries/:id`)에서 원문 패널, 태그 배지, 3개 탭(구조화/STARWL/패턴) 전환, 수정 모드가 다크 배경에서 잘 보이는지 확인.

- [ ] **Step 8: 커밋**

```bash
git add src/pages/EntryDetailPage.tsx
git commit -m "style: dark theme EntryDetailPage"
```

---

### Task 9: 인사이트(패턴) 화면 (`src/pages/InsightsPage.tsx`)

**Files:**
- Modify: `src/pages/InsightsPage.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: 없음

- [ ] **Step 1: 다크 전환**

`111번째 줄`을 교체:

```tsx
      <h2 className="text-xl font-semibold text-slate-50">나의 에너지 패턴</h2>
```

`114번째 줄`을 교체:

```tsx
        <p className="mt-2 text-sm text-slate-400">
```

`119번째 줄`을 교체:

```tsx
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
```

`120번째 줄`을 교체:

```tsx
      {loading && <p className="mt-2 text-sm text-slate-400">분석 중...</p>}
```

`124번째 줄`을 교체:

```tsx
          <h3 className="text-sm font-medium text-slate-300">⚡ 에너지를 얻는 조건</h3>
```

`127번째 줄`(에너자이저 카드)을 교체:

```tsx
              <li key={item.id} className="rounded-lg border-l-4 border-amber-400 bg-amber-500/10 p-3">
```

`128번째 줄`을 교체:

```tsx
                <p className="text-sm text-slate-100">{item.summary}</p>
```

`129번째 줄`을 교체:

```tsx
                <p className="mt-1 text-xs text-slate-400">근거 기록 {item.evidence_entry_ids.length}건</p>
```

`138번째 줄`(드레이너 카드)을 교체:

```tsx
          <h3 className="text-sm font-medium text-slate-300">🔋 소진되는 조건</h3>
```

`141번째 줄`을 교체:

```tsx
              <li key={item.id} className="rounded-lg border-l-4 border-slate-400 bg-slate-500/10 p-3">
```

`142번째 줄`을 교체:

```tsx
                <p className="text-sm text-slate-100">{item.summary}</p>
```

`143번째 줄`을 교체:

```tsx
                <p className="mt-1 text-xs text-slate-400">근거 기록 {item.evidence_entry_ids.length}건</p>
```

(150~156번째 줄 "다시 분석하기" 버튼은 `bg-slate-900 text-white` 패턴 그대로 유지)

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 통과

- [ ] **Step 3: 수동 확인**

`npm run dev` → `/insights`에서 기록이 3개 이상 쌓인 계정으로 에너자이저/드레이너 카드가 다크 배경에서 잘 읽히는지 확인. 3개 미만이면 안내 문구만 보이는 상태도 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/pages/InsightsPage.tsx
git commit -m "style: dark theme InsightsPage"
```

---

### Task 10: 전체 검증

**Files:**
- 없음 (검증 전용 태스크)

**Interfaces:**
- Consumes: Task 1~9의 모든 결과물
- Produces: 없음

- [ ] **Step 1: 빌드 클린 통과 확인**

Run: `npm run build`
Expected: `tsc -b`와 `vite build` 모두 에러 없이 통과

- [ ] **Step 2: 기존 테스트 스위트 통과 확인**

Run: `npm test`
Expected: `src/lib/*.test.ts` 전체 통과 (색상 변경과 무관한 로직 테스트이므로 이번 작업으로 실패하는 케이스가 있으면 안 됨)

- [ ] **Step 3: 5개 화면 모바일 뷰포트(375px) 수동 스크린샷 확인**

`npm run dev` 실행 후 브라우저 뷰포트를 375px로 맞추고 아래 화면을 각각 확인 (design.md의 접근성 기준 — 본문 텍스트 대비 4.5:1, UI 컴포넌트 대비 3:1을 브라우저 개발자도구 색상 대비 검사로 확인):

1. 로그인 화면(`/`, 비인증) — 탭 전환, 인풋, 소셜 버튼, 에러 배너
2. 기록 시작화면(`/`, 인증 후 choice 단계) — 음성/타이핑 카드, 하단 마이크 버튼
3. 음성 녹음화면(voice 단계) — 진한 그라디언트 배경, 텍스트 대비
4. 내 경험 목록(`/entries`) — 카드 스택, 검색/태그/정렬, 선택 모드
5. 기록 상세(`/entries/:id`) — 원문 패널, 3개 탭
6. 인사이트(`/insights`) — 에너자이저/드레이너 카드

- [ ] **Step 4: `design.md` 갱신**

`design.md`의 "적용 범위 밖 (이번에 안 함)" 절에서 "다크모드 전환" 줄을 제거하고, 대신 이번 전환 내용을 요약하는 절을 추가한다(정확한 문구는 구현 시점 파일 상태를 보고 작성 — 색상 매핑 표는 `docs/superpowers/specs/2026-08-30-dark-theme-conversion-design.md`를 참조로 링크).

- [ ] **Step 5: 커밋**

```bash
git add design.md
git commit -m "docs: update design.md for app-wide dark theme"
```
