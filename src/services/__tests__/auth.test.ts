import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Firebase is replaced by a stub whose sign-in state each test sets.
const firebase = vi.hoisted(() => ({ listener: null as null | ((user: unknown) => void) }));
vi.mock('firebase/app', () => ({ initializeApp: () => ({}), getApps: () => [], getApp: () => ({}) }));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  GoogleAuthProvider: class {
    addScope() {}
  },
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    firebase.listener = cb;
    return () => {};
  },
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

const USER = { uid: 'u1', displayName: 'Sherol' };

function memoryStorage(items: Record<string, string>) {
  const store = new Map(Object.entries(items));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}

/** Load auth.ts fresh (it keeps the token in module state), as a page reload would. */
async function reload(session: Record<string, string>) {
  vi.resetModules();
  vi.stubGlobal('sessionStorage', memoryStorage(session));
  const { initAuth } = await import('../auth');
  const calls = { success: vi.fn(), failure: vi.fn(), expired: vi.fn() };
  initAuth(calls.success, calls.failure, calls.expired);
  return calls;
}

describe('initAuth after a reload', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reconnects silently with a token that is still good', async () => {
    const calls = await reload({ sheetsync_oauth_token: 'tok', sheetsync_token_expires: String(Date.now() + 30 * 60_000) });
    firebase.listener!(USER);
    expect(calls.success).toHaveBeenCalledWith(USER, 'tok');
    expect(calls.expired).not.toHaveBeenCalled();
  });

  it('keeps the signed-in user when the token expired, so the header offers Reconnect', async () => {
    const calls = await reload({ sheetsync_oauth_token: 'tok', sheetsync_token_expires: String(Date.now() - 1000) });
    firebase.listener!(USER);
    expect(calls.expired).toHaveBeenCalledWith(USER);
    expect(calls.failure).not.toHaveBeenCalled();
    expect(calls.success).not.toHaveBeenCalled();
  });

  it('does the same when the tab has no token at all', async () => {
    const calls = await reload({});
    firebase.listener!(USER);
    expect(calls.expired).toHaveBeenCalledWith(USER);
    expect(calls.failure).not.toHaveBeenCalled();
  });

  it('reports signed out when there is no Firebase user', async () => {
    const calls = await reload({ sheetsync_oauth_token: 'tok', sheetsync_token_expires: String(Date.now() + 30 * 60_000) });
    firebase.listener!(null);
    expect(calls.failure).toHaveBeenCalled();
    expect(calls.expired).not.toHaveBeenCalled();
  });
});
