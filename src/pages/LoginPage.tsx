import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';
import { signInWithProvider, type SocialProvider } from '../lib/oauthProviders';
import { Logo } from '../components/Logo';
import { SpaceScene } from '../components/cosmic/SpaceScene';
import { GlassPanel } from '../components/ui/GlassCard';
import { CosmicInput } from '../components/ui/CosmicInput';
import { GradientButton, OutlineButton } from '../components/ui/CosmicButton';
import {
  ArrowRightIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  GoogleIcon,
  KakaoIcon,
  LockIcon,
  MailIcon,
} from '../components/icons';

type Mode = 'login' | 'signup';

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  // 로그인 화면에는 하단 네비게이션이 없다 — 화면 전체를 쓴다.
  const shell = (children: React.ReactNode) => (
    <div className="relative min-h-[100dvh] overflow-hidden">
      <SpaceScene variant="login" />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-10 pt-8">
        {children}
      </div>
    </div>
  );

  if (signupPendingEmail) {
    return shell(
      <>
        <Logo />
        <div className="flex flex-1 flex-col justify-center">
          <GlassPanel className="p-6">
            <p className="text-[15px] leading-relaxed text-ink">
              <span className="font-semibold">{signupPendingEmail}</span>로 확인 메일을 보냈습니다.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">
              메일의 링크를 눌러 인증을 완료하면 로그인할 수 있어요.
            </p>
            <OutlineButton type="button" onClick={() => switchMode('login')} className="mt-5">
              로그인 화면으로
            </OutlineButton>
          </GlassPanel>
        </div>
      </>,
    );
  }

  return shell(
    <>
      <div className="flex items-start justify-between gap-3">
        <Logo />
        <p className="hidden shrink-0 pt-1 text-right text-[11px] leading-relaxed text-ink-muted min-[380px]:block">
          <span className="block">오늘도</span>
          <span className="block">조금 더</span>
          <span className="block">나답게</span>
        </p>
      </div>

      <h1 className="mt-9 text-[30px] font-bold leading-[1.28] tracking-tight text-ink">
        경험을 기록하고,
        <br />
        <span
          className="bg-clip-text text-transparent"
          style={{ backgroundImage: 'linear-gradient(100deg, #ffd0bb 0%, #ffb3cd 45%, #d6b4ff 100%)' }}
        >
          나를 발견하다.
        </span>
      </h1>
      <p className="mt-4 text-[13px] leading-relaxed text-ink-dim">
        작은 경험이 모여
        <br />
        특별한 나를 만듭니다.
      </p>

      <GlassPanel className="mt-8 p-4">
        {/* 로그인/회원가입 세그먼티드 컨트롤 — 활성 쪽만 그라디언트 pill */}
        <div
          className="flex rounded-full border border-hairline p-1"
          style={{ background: 'rgba(6, 12, 28, 0.6)' }}
        >
          {(['login', 'signup'] as const).map((value) => {
            const active = mode === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => switchMode(value)}
                aria-pressed={active}
                className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors duration-200 ${
                  active ? 'text-white' : 'text-ink-dim hover:text-ink'
                }`}
                style={
                  active
                    ? {
                        background: 'var(--echo-gradient)',
                        boxShadow: '0 0 18px -6px rgba(241,74,180,0.8)',
                      }
                    : undefined
                }
              >
                {value === 'login' ? '로그인' : '회원가입'}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <CosmicInput
            type="email"
            aria-label="이메일"
            placeholder="이메일을 입력하세요"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            leading={<MailIcon />}
          />
          <CosmicInput
            type={showPassword ? 'text' : 'password'}
            aria-label="비밀번호"
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            leading={<LockIcon />}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink-dim"
              >
                {showPassword ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            }
          />
          {mode === 'signup' && (
            <CosmicInput
              type={showPassword ? 'text' : 'password'}
              aria-label="비밀번호 확인"
              placeholder="비밀번호를 한 번 더 입력하세요"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              leading={<LockIcon />}
            />
          )}

          {error && (
            <p role="alert" className="text-[13px] leading-relaxed text-echo-coral">
              {error}
            </p>
          )}

          <GradientButton type="submit" disabled={loading} trailing={<ArrowRightIcon className="h-4 w-4" />}>
            {loading ? (mode === 'login' ? '로그인 중...' : '가입 중...') : mode === 'login' ? '로그인' : '회원가입'}
          </GradientButton>
        </form>

        <div className="my-4 flex items-center gap-3 text-[11px] text-ink-muted">
          <div className="h-px flex-1 bg-hairline" />
          또는
          <div className="h-px flex-1 bg-hairline" />
        </div>

        <div className="space-y-2.5">
          <OutlineButton
            type="button"
            onClick={() => handleSocialLogin('google')}
            disabled={socialLoading !== null}
            leading={<GoogleIcon className="h-5 w-5" />}
            trailing={<ChevronRightIcon className="h-4 w-4 text-ink-muted" />}
          >
            {socialLoading === 'google' ? '연결 중...' : 'Google로 계속하기'}
          </OutlineButton>
          <OutlineButton
            type="button"
            onClick={() => handleSocialLogin('kakao')}
            disabled={socialLoading !== null}
            leading={
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FEE500]">
                <KakaoIcon className="h-3.5 w-3.5" />
              </span>
            }
            trailing={<ChevronRightIcon className="h-4 w-4 text-ink-muted" />}
          >
            {socialLoading === 'kakao' ? '연결 중...' : '카카오로 계속하기'}
          </OutlineButton>
        </div>

        <p className="mt-3 text-center text-[11px] text-ink-muted">
          소셜 로그인은 설정 완료 후 사용할 수 있어요.
        </p>
      </GlassPanel>

      <button
        type="button"
        onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
        className="mx-auto mt-7 flex items-center gap-1.5 text-[13px] text-ink-dim transition-colors hover:text-ink"
      >
        {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
        <span className="font-semibold text-ink underline underline-offset-4">
          {mode === 'login' ? '회원가입' : '로그인'}
        </span>
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </button>
    </>,
  );
}
