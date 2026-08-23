import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabaseClient';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-slate-900">ECHO</h1>
        <p className="mt-1 text-sm text-slate-500">경험을 기록하고, 나를 발견하다.</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm"
      >
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-violet-400 focus:outline-none"
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-violet-400 focus:outline-none"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-1 rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}
