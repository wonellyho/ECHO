import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest } from '@vercel/node';
import { authenticate } from './auth.js';

// 이 관문이 뚫리면 곧바로 요금이 샌다. 특히 "설정이 빠졌을 때 통과시키지 않는다"는
// fail-closed 동작은 실수로 뒤집히기 쉬워서 테스트로 못 박아둔다.

const ORIGINAL_ENV = { ...process.env };

function request(headers: Record<string, string> = {}): VercelRequest {
  return { headers } as unknown as VercelRequest;
}

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://proj.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_ANON_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe('authenticate', () => {
  it('유효한 토큰이면 사용자를 돌려준다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'user-123', email: 'a@b.com' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await authenticate(request({ authorization: 'Bearer good-token' }));
    expect(result).toEqual({ ok: true, user: { id: 'user-123', email: 'a@b.com' } });
  });

  it('토큰과 anon key를 Supabase에 올바르게 전달한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'u' }) });
    vi.stubGlobal('fetch', fetchMock);

    await authenticate(request({ authorization: 'Bearer good-token' }));

    expect(fetchMock).toHaveBeenCalledWith('https://proj.supabase.co/auth/v1/user', {
      headers: { authorization: 'Bearer good-token', apikey: 'anon-key' },
    });
  });

  it('Authorization 헤더가 없으면 401 — Supabase에 묻지도 않는다', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await authenticate(request());
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Bearer 형식이 아니면 401', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    for (const header of ['good-token', 'Basic abc', 'Bearer', 'Bearer   ']) {
      const result = await authenticate(request({ authorization: header }));
      expect(result, header).toMatchObject({ ok: false, status: 401 });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Supabase가 토큰을 거부하면 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));

    const result = await authenticate(request({ authorization: 'Bearer expired' }));
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('응답에 사용자 id가 없으면 401 — 200이라고 통과시키지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    const result = await authenticate(request({ authorization: 'Bearer weird' }));
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('환경변수가 없으면 막는다(fail closed) — 통과시키면 무료 LLM 프록시가 된다', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await authenticate(request({ authorization: 'Bearer good-token' }));
    expect(result).toMatchObject({ ok: false, status: 500 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Supabase에 연결하지 못해도 통과시키지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await authenticate(request({ authorization: 'Bearer good-token' }));
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it('VITE_* 환경변수만 있어도 동작한다 — Vercel은 접두사와 무관하게 함수로 넘겨준다', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    process.env.VITE_SUPABASE_URL = 'https://proj.supabase.co/';
    process.env.VITE_SUPABASE_ANON_KEY = 'vite-anon';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'u' }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await authenticate(request({ authorization: 'Bearer t' }));
    expect(result).toMatchObject({ ok: true });
    // 끝의 슬래시가 중복되지 않아야 한다.
    expect(fetchMock).toHaveBeenCalledWith('https://proj.supabase.co/auth/v1/user', expect.anything());
  });
});
