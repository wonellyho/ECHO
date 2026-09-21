# 로그인/가입 화면 + 기록 시작화면 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ECHO 로고 컴포넌트를 만들고, 로그인/가입 화면과 기록 시작화면(`RecordPage`의 `choice` 단계)을
시각적으로 리디자인하며, Google/Kakao 소셜 로그인 버튼 UI를 (실제 연동 없이) 추가한다.

**Architecture:** 순수 React 컴포넌트 추가/수정만으로 이루어지는 프론트엔드 전용 작업. 새 비즈니스
로직은 OAuth 호출 헬퍼 하나뿐이며, 이건 Supabase 클라이언트를 인자로 받는 순수 함수로 분리해서
mock 클라이언트로 단위 테스트한다. 나머지(로고, 아이콘, 레이아웃)는 프리젠테이션 컴포넌트라
기존 코드베이스 관례대로(예: `icons.tsx`) 별도 테스트 없이 `npm run build` 타입체크로 검증한다.

**Tech Stack:** React + TypeScript (Vite), Tailwind CSS v4, `@supabase/supabase-js`, Vitest.

## Global Constraints

- 그라디언트 팔레트는 기존에 이미 쓰는 `orange-400 → pink-500`만 재사용한다 — 새 색 추가 금지
  (design.md 원칙: 그라디언트는 카드스택+녹음화면 두 곳에만 쓰던 것을, 이번 스펙에서 로고/버튼 포인트로
  넓히는 것까지만 허용됨. 화면 전체 배경을 그라디언트로 바꾸지 않는다).
- 로그인 화면 배경은 계속 `bg-slate-50` 라이트 유지.
- 실제 Google/Kakao OAuth 연동(Supabase provider 등록)은 이번 스코프 밖 — 버튼은 실제
  `signInWithOAuth`를 호출하는 코드로 작성하되, provider 미등록 상태의 에러는 기존 에러 배너에 그대로
  노출한다.
- `NavBar`에 로고 삽입, 랜딩페이지, 레퍼런스 적용, 기록/내경험 리스트 UX는 이번 스코프 밖.
- 폰트는 프로젝트 전역 Pretendard를 그대로 쓴다 (별도 지정 불필요, `body`에 이미 적용됨).
- 기존 회원가입 검증 로직(`password !== passwordConfirm`, 이메일 확인 대기 분기)은 변경하지 않는다 —
  레이아웃만 수정.

---

## Task 1: OAuth 로그인 헬퍼 (`src/lib/oauthProviders.ts`)

**Files:**
- Create: `src/lib/oauthProviders.ts`
- Test: `src/lib/oauthProviders.test.ts`

**Interfaces:**
- Consumes: 없음 (Supabase 클라이언트 인스턴스를 인자로 받는 순수 함수 — 실제 클라이언트는
  `src/lib/supabaseClient.ts`의 `supabase`를 호출부에서 넘긴다)
- Produces:
  - `signInWithProvider(client: Pick<SupabaseClient, 'auth'>, provider: 'google' | 'kakao'): Promise<{ error: Error | null }>`
    — Task 3(LoginPage)에서 이 함수를 import해서 버튼 `onClick`에 연결한다.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/oauthProviders.test.ts
import { describe, expect, test, vi } from 'vitest';
import { signInWithProvider } from './oauthProviders';

function makeFakeClient(signInWithOAuthImpl: (args: unknown) => Promise<{ error: Error | null }>) {
  return {
    auth: {
      signInWithOAuth: vi.fn(signInWithOAuthImpl),
    },
  };
}

describe('signInWithProvider', () => {
  test('calls signInWithOAuth with the given provider', async () => {
    const client = makeFakeClient(async () => ({ error: null }));

    await signInWithProvider(client, 'google');

    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google' });
  });

  test('calls signInWithOAuth with kakao provider', async () => {
    const client = makeFakeClient(async () => ({ error: null }));

    await signInWithProvider(client, 'kakao');

    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'kakao' });
  });

  test('returns the error from signInWithOAuth when provider is not configured', async () => {
    const oauthError = new Error('Unsupported provider');
    const client = makeFakeClient(async () => ({ error: oauthError }));

    const result = await signInWithProvider(client, 'kakao');

    expect(result.error).toBe(oauthError);
  });

  test('returns no error on success', async () => {
    const client = makeFakeClient(async () => ({ error: null }));

    const result = await signInWithProvider(client, 'google');

    expect(result.error).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/oauthProviders.test.ts`
Expected: FAIL — `Cannot find module './oauthProviders'` (파일이 아직 없음)

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/oauthProviders.ts
import type { SupabaseClient } from '@supabase/supabase-js';

// 로그인 화면의 소셜 로그인 버튼이 호출하는 얇은 래퍼.
// Supabase 프로젝트에 provider(Google/Kakao)가 등록되기 전까지는 signInWithOAuth가
// 에러를 반환하는데, 그 에러를 그대로 호출부에 돌려줘서 기존 에러 배너에 표시하게 한다.
export type SocialProvider = 'google' | 'kakao';

type AuthOnlyClient = Pick<SupabaseClient, 'auth'>;

export async function signInWithProvider(
  client: AuthOnlyClient,
  provider: SocialProvider,
): Promise<{ error: Error | null }> {
  const { error } = await client.auth.signInWithOAuth({ provider });
  return { error };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/oauthProviders.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/oauthProviders.ts src/lib/oauthProviders.test.ts
git commit -m "feat: add signInWithProvider OAuth helper for social login buttons

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MdykU3H5sYsiSgMAkhuezp"
```

---

## Task 2: ECHO 로고 컴포넌트 (`src/components/Logo.tsx`)

**Files:**
- Create: `src/components/Logo.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `Logo({ variant?: 'icon' | 'full'; className?: string }): JSX.Element` — 기본값
  `variant = 'full'`. Task 3(LoginPage), Task 4(RecordPage choice)에서
  `import { Logo } from '../components/Logo'`로 사용.

- [ ] **Step 1: Write the component**

```typescript
// src/components/Logo.tsx
// ECHO 워드마크 + echo 림플 아이콘 (중심 점 + 동심 아크 2줄).
// 그라디언트는 기존 녹음 화면(RecordPage voice 단계)과 동일한 orange-400 → pink-500을 재사용한다
// (design.md 팔레트 원칙 — 새 색 추가하지 않음).
export function Logo({
  variant = 'full',
  className = '',
}: {
  variant?: 'icon' | 'full';
  className?: string;
}) {
  const icon = (
    <svg viewBox="0 0 40 40" className="h-8 w-8 shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id="echo-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="3" fill="url(#echo-logo-gradient)" />
      <path
        d="M14 20a6 6 0 0 1 12 0"
        stroke="url(#echo-logo-gradient)"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M9 20a11 11 0 0 1 22 0"
        stroke="url(#echo-logo-gradient)"
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        opacity={0.6}
      />
    </svg>
  );

  if (variant === 'icon') {
    return <span className={className}>{icon}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {icon}
      <span className="text-2xl font-bold tracking-tight text-slate-900">ECHO</span>
    </span>
  );
}
```

- [ ] **Step 2: Verify it type-checks and builds**

Run: `npm run build`
Expected: 클린 빌드 (에러 없음). 아직 아무 곳에서도 import하지 않으므로 unused-export 경고만
날 수 있는데, tsconfig에 `noUnusedLocals`가 export에는 적용되지 않으므로 문제 없어야 한다 — 만약
빌드가 실패하면 `tsconfig.json`의 관련 옵션을 확인한다.

- [ ] **Step 3: Commit**

```bash
git add src/components/Logo.tsx
git commit -m "feat: add ECHO logo component (echo ripple icon + wordmark)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MdykU3H5sYsiSgMAkhuezp"
```

---

## Task 3: 로그인/가입 화면 리디자인 (`LoginPage.tsx`)

**Files:**
- Modify: `src/pages/LoginPage.tsx` (전체 교체 — 로직은 기존 그대로 유지, 레이아웃만 재작성)
- Modify: `src/components/icons.tsx` (Google/Kakao 브랜드 아이콘 추가)

**Interfaces:**
- Consumes:
  - `Logo` from `../components/Logo` (Task 2)
  - `signInWithProvider` from `../lib/oauthProviders` (Task 1)
  - `supabase` from `../lib/supabaseClient` (기존)
- Produces: 없음 (최상위 페이지 컴포넌트)

- [ ] **Step 1: Add Google/Kakao brand icons to `src/components/icons.tsx`**

기존 파일 맨 아래에 추가:

```typescript
// 소셜 로그인 버튼용 브랜드 아이콘. 공식 브랜드 색을 그대로 사용한다(그라디언트 팔레트 아님).
export function GoogleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.35.6 4.6 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export function KakaoIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#000000"
        fillOpacity={0.85}
        d="M12 3C6.48 3 2 6.48 2 10.7c0 2.71 1.85 5.08 4.63 6.44-.2.75-.73 2.73-.84 3.15-.13.53.19.52.4.38.17-.11 2.65-1.8 3.73-2.54.68.1 1.38.15 2.08.15 5.52 0 10-3.48 10-7.58C22 6.48 17.52 3 12 3Z"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Rewrite `LoginPage.tsx`**

```typescript
import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { signInWithProvider, type SocialProvider } from '../lib/oauthProviders';
import { Logo } from '../components/Logo';
import { GoogleIcon, KakaoIcon } from '../components/icons';

type Mode = 'login' | 'signup';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  // 프로젝트의 이메일 확인(confirm) 설정이 켜져 있으면 가입 직후 세션이 바로 생기지 않는다 —
  // 그 경우 로그인 화면으로 돌아가지 않고 "메일함을 확인해주세요" 안내만 보여준다.
  const [signupPendingEmail, setSignupPendingEmail] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPassword('');
    setPasswordConfirm('');
    setSignupPendingEmail(null);
  }

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function handleSignup() {
    if (password !== passwordConfirm) {
      throw new Error('비밀번호가 서로 다릅니다.');
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (!data.session) {
      setSignupPendingEmail(email);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await handleLogin();
      } else {
        await handleSignup();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : mode === 'login' ? '로그인에 실패했습니다.' : '회원가입에 실패했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSocialLogin(provider: SocialProvider) {
    setError(null);
    setSocialLoading(provider);
    const { error } = await signInWithProvider(supabase, provider);
    if (error) {
      setError(error.message);
    }
    setSocialLoading(null);
  }

  if (signupPendingEmail) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-6">
        <Logo />
        <p className="mt-1 text-sm text-slate-500">경험을 기록하고, 나를 발견하다.</p>

        <div className="mt-6 rounded-md border border-slate-300 p-3 text-sm text-slate-700">
          <p>
            <span className="font-medium">{signupPendingEmail}</span>로 확인 메일을 보냈습니다.
          </p>
          <p className="mt-1 text-slate-500">메일의 링크를 눌러 인증을 완료하면 로그인할 수 있어요.</p>
        </div>

        <button
          type="button"
          onClick={() => switchMode('login')}
          className="mt-4 w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          로그인 화면으로
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-6">
      <Logo />
      <p className="mt-1 text-sm text-slate-500">경험을 기록하고, 나를 발견하다.</p>

      <div className="mt-6 inline-flex rounded-full bg-slate-100 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => switchMode('login')}
          className={`flex-1 rounded-full px-4 py-1.5 transition-colors ${
            mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          로그인
        </button>
        <button
          type="button"
          onClick={() => switchMode('signup')}
          className={`flex-1 rounded-full px-4 py-1.5 transition-colors ${
            mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          회원가입
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        {mode === 'signup' && (
          <input
            type="password"
            placeholder="비밀번호 확인"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-gradient-to-r from-orange-400 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (mode === 'login' ? '로그인 중...' : '가입 중...') : mode === 'login' ? '로그인' : '회원가입'}
        </button>
      </form>

      <div className="mt-5 flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        또는
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={() => handleSocialLogin('google')}
          disabled={socialLoading !== null}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <GoogleIcon />
          {socialLoading === 'google' ? '연결 중...' : 'Google로 계속하기'}
        </button>
        <button
          type="button"
          onClick={() => handleSocialLogin('kakao')}
          disabled={socialLoading !== null}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#FEE500] px-4 py-2.5 text-sm font-medium text-black/85 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <KakaoIcon />
          {socialLoading === 'kakao' ? '연결 중...' : '카카오로 계속하기'}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-slate-400">소셜 로그인은 설정 완료 후 사용할 수 있어요.</p>

      <button
        type="button"
        onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
        className="mt-4 text-center text-sm text-slate-500 hover:text-slate-700"
      >
        {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Build and run full test suite**

Run: `npm run build && npm test`
Expected: 클린 빌드, 모든 테스트 통과(기존 테스트 + Task 1의 `oauthProviders.test.ts`).

- [ ] **Step 4: Manual check**

`npm run dev`로 로그인 화면을 열어 다음을 확인한다 (Playwright/Chrome 자동화 없이 직접 브라우저 또는
`run` 스킬 사용):
- 로고(아이콘+워드마크)가 상단에 보인다.
- 로그인/회원가입 pill 토글이 정상 전환된다.
- Google/Kakao 버튼 클릭 시 에러 배너에 Supabase 에러 메시지가 뜬다(provider 미등록 상태이므로
  에러가 뜨는 게 정상 — "정상 동작"의 기준은 에러가 나더라도 화면이 깨지지 않고 배너에 표시되는 것).
- 375px 모바일 뷰포트에서 레이아웃이 잘리지 않는다.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LoginPage.tsx src/components/icons.tsx
git commit -m "feat: redesign login/signup screen with logo, pill toggle, social login UI

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MdykU3H5sYsiSgMAkhuezp"
```

---

## Task 4: 기록 시작화면(choice 단계) 리디자인 (`RecordPage.tsx`)

**Files:**
- Modify: `src/pages/RecordPage.tsx:268-317` (오직 `step === 'choice'` 블록만 교체 — 다른 단계는
  건드리지 않는다)
- Modify: `src/components/icons.tsx` (`TypingIcon` 추가)

**Interfaces:**
- Consumes:
  - `Logo` from `../components/Logo` (Task 2)
  - `MicIcon`, `TypingIcon` from `./icons` (기존 + 이 태스크에서 추가)
- Produces: 없음

- [ ] **Step 1: Add `TypingIcon` to `src/components/icons.tsx`**

```typescript
// 타이핑 기록 카드용 아이콘 (연필/텍스트 라인).
export function TypingIcon({ className = 'h-6 w-6 text-white' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
```

- [ ] **Step 2: Replace the `step === 'choice'` block in `RecordPage.tsx`**

`src/pages/RecordPage.tsx` 7번째 줄의 기존 import를 다음으로 교체:

```typescript
import { MicIcon, StopIcon, TypingIcon } from '../components/icons';
```

그리고 6번째 줄(`import { VoiceWaveform } ...`) 아래에 새 import를 추가:

```typescript
import { Logo } from '../components/Logo';
```

`if (step === 'choice') { ... }` 블록(현재 268~317줄)을 다음으로 통째로 교체:

```typescript
  if (step === 'choice') {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col px-4 py-6">
        <Logo />
        <h2 className="mt-6 text-xl font-semibold text-slate-900">오늘의 경험을 남겨보세요</h2>
        <p className="mt-2 text-sm text-slate-500">말하거나 적으면 AI가 구조화해 둡니다.</p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={goToVoice}
            disabled={!speech.isSupported}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500">
              <MicIcon className="h-5 w-5 text-white" />
            </span>
            <span>
              <p className="text-sm font-semibold text-slate-900">음성으로 기록</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {speech.isSupported ? '말하면 자동으로 글로 옮깁니다' : '사용 불가'}
              </p>
            </span>
          </button>
          <button
            type="button"
            onClick={goToTyping}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-slate-50"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-700">
              <TypingIcon className="h-5 w-5 text-white" />
            </span>
            <span>
              <p className="text-sm font-semibold text-slate-900">타이핑으로 기록</p>
              <p className="mt-0.5 text-xs text-slate-500">직접 입력합니다</p>
            </span>
          </button>
        </div>

        {!speech.isSupported && (
          <p className="mt-3 rounded-md border border-slate-300 p-2.5 text-xs text-slate-700">
            이 브라우저에서는 음성 입력을 쓸 수 없습니다. 타이핑으로 기록해주세요.
          </p>
        )}

        <div className="mt-auto flex flex-col items-center gap-2 pt-8">
          <p className="text-xs text-slate-500">눌러서 바로 녹음 시작</p>
          <button
            type="button"
            onClick={goToVoice}
            disabled={!speech.isSupported}
            aria-label="음성으로 기록 시작"
            className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-pink-500 p-1 disabled:opacity-40"
          >
            <span className="flex h-full w-full items-center justify-center rounded-full bg-slate-900">
              <MicIcon className="h-7 w-7 text-white" />
            </span>
          </button>
        </div>
      </div>
    );
  }
```

- [ ] **Step 3: Build and run full test suite**

Run: `npm run build && npm test`
Expected: 클린 빌드, 모든 테스트 통과.

- [ ] **Step 4: Manual check**

`npm run dev`로 로그인 후 기록 시작화면(`/`)을 확인:
- 로고가 상단에 보인다.
- 음성/타이핑 버튼이 원형 그라디언트/슬레이트 배지가 있는 카드 형태로 보인다.
- 하단 큰 마이크 버튼에 그라디언트 링이 보인다.
- 버튼 클릭 시 기존과 동일하게 `voice`/`typing` 단계로 정상 전환된다(로직 변경 없음 — 회귀 없는지만
  확인).

- [ ] **Step 5: Commit**

```bash
git add src/pages/RecordPage.tsx src/components/icons.tsx
git commit -m "feat: redesign record choice screen with logo and gradient badge cards

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MdykU3H5sYsiSgMAkhuezp"
```

---

## Task 5: OAuth 설정 가이드 문서 + 최종 검증

**Files:**
- Create: `docs/oauth-setup.md`

**Interfaces:**
- Consumes: 없음 (문서만)
- Produces: 없음

- [ ] **Step 1: Write the guide**

```markdown
# Google / Kakao 소셜 로그인 설정 가이드

Task 1~4에서 만든 로그인 화면의 Google/Kakao 버튼은 이미 `supabase.auth.signInWithOAuth`를
호출하는 실제 코드로 연결돼 있다. 아래 절차대로 Supabase 프로젝트에 provider를 등록하면
**코드 수정 없이 바로 동작한다.**

## Google

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성(또는 기존 프로젝트 사용).
2. "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID" → 애플리케이션 유형
   "Web application" 선택.
3. "Authorized redirect URIs"에 Supabase 프로젝트의 콜백 URL을 등록:
   `https://<프로젝트 참조 ID>.supabase.co/auth/v1/callback`
   (Supabase 대시보드의 Authentication → Providers → Google 화면에 정확한 URL이 표시된다.)
4. 발급된 Client ID / Client Secret을 Supabase 대시보드 → Authentication → Providers → Google에
   입력하고 토글을 켠다.

## Kakao

1. [Kakao Developers](https://developers.kakao.com/)에서 애플리케이션 생성.
2. "제품 설정" → "카카오 로그인" 활성화, "Redirect URI"에 위와 동일한 Supabase 콜백 URL 등록.
3. "앱 키" 화면에서 REST API 키를 확인.
4. Supabase 대시보드 → Authentication → Providers → Kakao에 REST API 키(Client ID)를 입력하고
   토글을 켠다. (Kakao는 Client Secret이 선택사항인 provider이므로, Kakao Developers의 보안 설정에서
   Client Secret을 발급했다면 그것도 함께 입력한다.)

## 확인

두 provider 모두 등록 후, 로그인 화면에서 각 버튼을 눌러 OAuth 동의 화면으로 리다이렉트되는지
확인한다. 에러가 뜬다면 redirect URI가 정확히 일치하는지부터 다시 확인한다.
```

- [ ] **Step 2: Final full verification**

Run: `npm run build && npm test`
Expected: 클린 빌드, 모든 테스트 통과 (Task 1~4의 변경 포함 전체).

- [ ] **Step 3: Commit**

```bash
git add docs/oauth-setup.md
git commit -m "docs: add Google/Kakao OAuth provider setup guide

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MdykU3H5sYsiSgMAkhuezp"
```
