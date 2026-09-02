import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/useAuth';
import {
  canSubmitNickname,
  NICKNAME_MAX_LENGTH,
  normalizeNickname,
} from '../lib/profileValidation';

// 내 정보 화면. 닉네임은 별도 테이블 없이 Supabase Auth의 user_metadata에 저장한다 —
// PRD §6에서 SNS/공유를 스코프 밖으로 두었으므로 다른 사용자가 이 값을 읽을 일이 없고,
// 그렇다면 profiles 테이블 + RLS를 만들 이유도 없다 (스펙 문서 참고).
export function ProfilePage() {
  const { user } = useAuth();

  // 닉네임은 세션에 이미 들어 있으므로 별도 조회 없이 초기값으로 바로 쓴다.
  // (App이 user가 있을 때만 이 화면을 렌더한다.)
  // effect로 user를 감시해 setState하면, 토큰 갱신으로 user 객체가 새로 오는 순간
  // 입력 중이던 값이 덮어써진다 — 그래서 초기값으로만 읽는다.
  const initialNickname = (user?.user_metadata?.nickname as string | undefined) ?? '';

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
    <div className="mx-auto max-w-md px-4 py-6 pb-[calc(var(--bottom-nav-total)+1.5rem)]">
      <h2 className="text-xl font-semibold text-slate-50">내 정보</h2>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-xs text-slate-400">로그인 계정</p>
        <p className="mt-1 break-all text-sm text-slate-100">{user?.email ?? '-'}</p>

        <div className="mt-4 border-t border-slate-800 pt-4">
          <p className="text-xs text-slate-400">지금까지 남긴 기록</p>
          <p className="mt-1 text-sm text-slate-100">
            {entryCount === null ? '—' : `${entryCount}개`}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <label htmlFor="nickname" className="text-xs text-slate-400">
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
          className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
        />
        <p className="mt-1.5 text-xs text-slate-500">최대 {NICKNAME_MAX_LENGTH}자</p>

        {/* 저장 결과는 화면에만 바뀌므로, 보조기술에도 알려야 눌린 결과를 알 수 있다. */}
        <div aria-live="polite">
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          {saved && !changed && <p className="mt-2 text-xs text-green-400">저장했습니다.</p>}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !canSubmitNickname(nickname) || !changed}
          className="mt-3 w-full rounded-md bg-slate-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-600 disabled:opacity-50"
        >
          {saving ? '저장 중...' : '닉네임 저장'}
        </button>
      </div>

      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="mt-4 w-full rounded-md border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
      >
        로그아웃
      </button>
    </div>
  );
}
