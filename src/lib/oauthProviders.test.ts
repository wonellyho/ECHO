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
