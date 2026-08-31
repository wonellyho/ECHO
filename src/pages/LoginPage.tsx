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
    // data.session이 바로 존재하면(이메일 확인이 꺼져 있는 프로젝트 설정) 여기서 따로 화면을 전환할
    // 필요가 없다 — useAuth 훅의 onAuthStateChange 리스너가 세션 생성을 감지해서 알아서 처리한다.
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
    try {
      const { error } = await signInWithProvider(supabase, provider);
      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '소셜 로그인에 실패했습니다.');
    } finally {
      setSocialLoading(null);
    }
  }

  if (signupPendingEmail) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-slate-950 px-4 py-6">
        <Logo />
        <p className="mt-1 text-sm text-slate-400">경험을 기록하고, 나를 발견하다.</p>

        <div className="mt-6 rounded-md border border-slate-700 p-3 text-sm text-slate-200">
          <p>
            <span className="font-medium">{signupPendingEmail}</span>로 확인 메일을 보냈습니다.
          </p>
          <p className="mt-1 text-slate-400">메일의 링크를 눌러 인증을 완료하면 로그인할 수 있어요.</p>
        </div>

        <button
          type="button"
          onClick={() => switchMode('login')}
          className="mt-4 w-full rounded-md border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
        >
          로그인 화면으로
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-slate-950 px-4 py-6">
      <Logo />
      <p className="mt-1 text-sm text-slate-400">경험을 기록하고, 나를 발견하다.</p>

      <div className="mt-6 inline-flex rounded-full bg-slate-800 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => switchMode('login')}
          aria-pressed={mode === 'login'}
          className={`flex-1 rounded-full px-4 py-1.5 transition-colors ${
            mode === 'login' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400'
          }`}
        >
          로그인
        </button>
        <button
          type="button"
          onClick={() => switchMode('signup')}
          aria-pressed={mode === 'signup'}
          className={`flex-1 rounded-full px-4 py-1.5 transition-colors ${
            mode === 'signup' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400'
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
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
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
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
          />
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-gradient-to-r from-orange-400 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (mode === 'login' ? '로그인 중...' : '가입 중...') : mode === 'login' ? '로그인' : '회원가입'}
        </button>
      </form>

      <div className="mt-5 flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-800" />
        또는
        <div className="h-px flex-1 bg-slate-800" />
      </div>

      <div className="mt-4 space-y-2">
        <button
          type="button"
          onClick={() => handleSocialLogin('google')}
          disabled={socialLoading !== null}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:opacity-50"
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
        className="mt-4 text-center text-sm text-slate-400 hover:text-slate-200"
      >
        {mode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
      </button>
    </div>
  );
}
