import { useSyncExternalStore } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

// 세션은 **앱 전체에 하나만** 존재한다.
//
// 예전에는 useAuth()가 호출될 때마다 자기 useState와 자기 getSession()을 들고 있었다.
// 그러면 훅 인스턴스마다 "처음엔 로그인 안 된 상태(null), 잠시 뒤 세션 도착"이라는 과정을
// 따로 겪는다. 라우트 가드 두 개가 이걸 각자 겪으면 서로를 튕겨내는 무한 루프가 된다:
//
//   1. 로그인한 사용자가 /app 진입 → RequireApp이 새로 마운트되며 useAuth 초기값 null을 보고
//      "비로그인이네" 판단 → /login으로 보냄
//   2. /login의 LoginRoute도 새로 마운트 → 초기값 null → 로그인 화면을 그림 → 잠시 뒤
//      getSession()이 도착해 "이미 로그인했네" → /app으로 보냄
//   3. 1번으로 되돌아가 영원히 반복. 매 왕복마다 getSession()과 onAuthStateChange 구독이
//      새로 생겨 화면이 멈춘 것처럼 느려진다.
//
// 그래서 세션 상태를 모듈 하나가 들고, 모든 useAuth()가 그 하나를 구독만 한다. 어느 화면에서
// 부르든 같은 값을 같은 시점에 보므로 위 경합 자체가 성립하지 않는다.

export interface AuthState {
  session: Session | null;
  user: User | null;
  /** 첫 세션 조회가 끝나기 전. 이때는 로그인 여부를 아직 알 수 없으므로 판단을 미뤄야 한다. */
  loading: boolean;
}

const LOADING_STATE: AuthState = { session: null, user: null, loading: true };

// useSyncExternalStore는 getSnapshot이 매번 같은 참조를 돌려주기를 요구한다 — 새 객체를
// 만들어 돌려주면 "바뀌었다"고 보고 무한 렌더링에 빠진다. 그래서 값이 실제로 바뀔 때만
// 새 객체로 교체한다.
let state: AuthState = LOADING_STATE;

const listeners = new Set<() => void>();
let started = false;

function setSession(session: Session | null) {
  // 같은 세션이면 새 객체를 만들지 않는다. onAuthStateChange는 토큰 갱신 등으로도 불리는데,
  // 그때마다 참조가 바뀌면 앱 전체가 의미 없이 리렌더된다.
  if (!state.loading && state.session?.access_token === session?.access_token) return;
  state = { session, user: session?.user ?? null, loading: false };
  for (const listener of listeners) listener();
}

/** 첫 구독자가 생길 때 한 번만 Supabase에 붙는다. */
function start() {
  if (started) return;
  started = true;

  supabase.auth.getSession().then(({ data }) => setSession(data.session));
  // 구독은 앱이 살아 있는 동안 유지한다 — 해제할 시점이 따로 없고, 화면 전환마다 붙였다
  // 뗐다 하면 그 사이에 일어난 로그인/로그아웃을 놓친다.
  supabase.auth.onAuthStateChange((_event, session) => setSession(session));
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): AuthState {
  return state;
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
