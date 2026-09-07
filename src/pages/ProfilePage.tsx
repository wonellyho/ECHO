import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/useAuth';
import {
  canSubmitNickname,
  NICKNAME_MAX_LENGTH,
  normalizeNickname,
} from '../lib/profileValidation';
import { readNickname } from '../lib/useNickname';
import { Logo } from '../components/Logo';
import { CosmicPage } from '../components/cosmic/CosmicPage';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton, OutlineButton } from '../components/ui/CosmicButton';
import { DocumentIcon, MailIcon } from '../components/icons';

// 내 정보 화면. 닉네임은 별도 테이블 없이 Supabase Auth의 user_metadata에 저장한다 —
// PRD §6에서 SNS/공유를 스코프 밖으로 두었으므로 다른 사용자가 이 값을 읽을 일이 없고,
// 그렇다면 profiles 테이블 + RLS를 만들 이유도 없다 (스펙 문서 참고).
//
// 화면 분위기는 다른 탭보다 차분하다 (레퍼런스 08) — 은하수가 없고, 오른쪽 위 큰 행성의
// 가장자리와 아래쪽 작은 위성만 남긴 조용한 궤도 공간이다. 여기서는 배경이 아니라
// 폼 카드가 주인공이다.
export function ProfilePage() {
  const { user } = useAuth();

  // 닉네임은 세션에 이미 들어 있으므로 별도 조회 없이 초기값으로 바로 쓴다.
  // (App이 user가 있을 때만 이 화면을 렌더한다.)
  // effect로 user를 감시해 setState하면, 토큰 갱신으로 user 객체가 새로 오는 순간
  // 입력 중이던 값이 덮어써진다 — 그래서 초기값으로만 읽는다.
  const initialNickname = readNickname(user?.user_metadata);

  const [nickname, setNickname] = useState(initialNickname);
  const [savedNickname, setSavedNickname] = useState(initialNickname);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entryCount, setEntryCount] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { count, error: countError } = await supabase
        .from('entries')
        .select('id', { count: 'exact', head: true });
      // 개수를 못 불러와도 화면 나머지는 정상 동작해야 하므로 에러를 띄우지 않는다.
      if (countError) return;
      setEntryCount(count ?? 0);
    })();
  }, []);

  async function handleSave() {
    if (!canSubmitNickname(nickname)) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const value = normalizeNickname(nickname);
      const { error: updateError } = await supabase.auth.updateUser({
        data: { nickname: value },
      });
      if (updateError) throw updateError;
      setNickname(value);
      setSavedNickname(value);
      setSaved(true);
    } catch (err) {
      // Supabase가 돌려주는 원문은 영어이고 구현 용어라 사용자에게 그대로 보여주지 않는다.
      console.error('닉네임 저장 실패', err);
      setError('닉네임을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  const changed = normalizeNickname(nickname) !== savedNickname;

  return (
    <CosmicPage variant="profile">
      <Logo />

      <h1 className="mt-9 text-[30px] font-bold tracking-tight text-ink">내 정보</h1>
      <p className="mt-2.5 text-[13px] text-ink-dim">나의 경험이 더 나은 나를 만듭니다.</p>

      {/* 계정 요약 — 항목마다 아이콘 오브 + 라벨 + 값 */}
      <GlassCard className="mt-6 px-4 py-2">
        <div className="flex items-center gap-4 py-3">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-hairline text-cosmic-blue"
            style={{ background: 'rgba(90, 120, 200, 0.12)' }}
          >
            <MailIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-ink-muted">로그인 계정</p>
            <p className="mt-0.5 break-all text-[15px] font-medium text-ink">{user?.email ?? '-'}</p>
          </div>
        </div>

        <div className="h-px bg-hairline" />

        <div className="flex items-center gap-4 py-3">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-hairline text-cosmic-indigo"
            style={{ background: 'rgba(120, 110, 210, 0.12)' }}
          >
            <DocumentIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-ink-muted">지금까지 남긴 기록</p>
            <p className="mt-0.5 text-[15px] font-medium text-ink">
              {entryCount === null ? '—' : `${entryCount}개`}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* 닉네임 패널 — 이 화면의 주인공 */}
      <GlassCard active accent="167, 110, 255" className="mt-4 p-4">
        <label htmlFor="nickname" className="text-sm font-semibold text-ink">
          닉네임
        </label>
        <input
          id="nickname"
          type="text"
          value={nickname}
          maxLength={NICKNAME_MAX_LENGTH + 2}
          onChange={(e) => {
            setNickname(e.target.value);
            setSaved(false);
          }}
          placeholder="어떻게 불러드릴까요?"
          className="mt-2.5 min-h-[3rem] w-full rounded-2xl border border-hairline bg-[rgba(10,20,40,0.38)] px-4 text-[15px] text-ink backdrop-blur-xl placeholder:text-ink-muted focus:border-hairline-active focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">다른 사용자에게 표시될 이름이에요.</p>
          <p className="shrink-0 text-xs tabular-nums text-ink-muted">
            {normalizeNickname(nickname).length}/{NICKNAME_MAX_LENGTH}
          </p>
        </div>

        {/* 저장 결과는 화면에만 바뀌므로, 보조기술에도 알려야 눌린 결과를 알 수 있다. */}
        <div aria-live="polite">
          {error && <p className="mt-2 text-xs text-echo-coral">{error}</p>}
          {saved && !changed && <p className="mt-2 text-xs text-cosmic-cyan">저장했습니다.</p>}
        </div>

        <GradientButton
          type="button"
          onClick={handleSave}
          disabled={saving || !canSubmitNickname(nickname) || !changed}
          className="mt-4"
        >
          {saving ? '저장 중...' : '닉네임 저장'}
        </GradientButton>
      </GlassCard>

      <OutlineButton type="button" onClick={() => supabase.auth.signOut()} className="mt-4">
        로그아웃
      </OutlineButton>
    </CosmicPage>
  );
}
