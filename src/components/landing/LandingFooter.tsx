import { Link } from 'react-router-dom';
import { Logo } from '../Logo';
import { ROUTES } from '../../lib/routes';

export function LandingFooter({ isAuthed }: { isAuthed: boolean }) {
  return (
    <footer className="relative border-t border-hairline">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <Logo className="h-7 w-auto" />
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-ink-muted">
            Experience Capture &amp; Human Observation. 경험을 기록하고, 나를 발견하다.
            ECHO는 기록에 실제로 남은 것만 이야기합니다 — 성격 유형으로 당신을 규정하지 않습니다.
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-dim" aria-label="푸터">
          <a href="#about" className="transition-colors hover:text-ink">
            ECHO란
          </a>
          <a href="#how" className="transition-colors hover:text-ink">
            서비스 소개
          </a>
          <a href="#constellation" className="transition-colors hover:text-ink">
            별자리
          </a>
          <a href="#features" className="transition-colors hover:text-ink">
            기능
          </a>
          <a href="#pricing" className="transition-colors hover:text-ink">
            요금제
          </a>
          <Link to={isAuthed ? ROUTES.app : ROUTES.login} className="transition-colors hover:text-ink">
            {isAuthed ? '앱 이용하기' : '로그인'}
          </Link>
        </nav>
      </div>

      <p className="px-5 pb-8 text-[12px] text-ink-muted sm:px-6 lg:px-8">© 2026 ECHO</p>
    </footer>
  );
}
