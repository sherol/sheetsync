import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut 
} from 'firebase/auth';

// Fallback configuration if file is unavailable
const defaultFirebaseConfig = {
  projectId: "gen-lang-client-0263183169",
  appId: "1:138495577806:web:56ded045b4b2ca73878a9f",
  apiKey: "AIzaSyBifkz664y64TkdVgSvsRsVEuzEyZm19d4",
  authDomain: "gen-lang-client-0263183169.firebaseapp.com",
  storageBucket: "gen-lang-client-0263183169.firebasestorage.app",
  messagingSenderId: "138495577806",
  measurementId: "",
  oAuthClientId: "138495577806-5hvpqu6t7ei7g0n5q6fcodat1t0slpjv.apps.googleusercontent.com"
};

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

// Initialize Firebase safely
let appInstance: any = null;
let authInstance: any = null;
let providerInstance: GoogleAuthProvider | null = null;

try {
  appInstance = getApps().length === 0 ? initializeApp(defaultFirebaseConfig) : getApp();
  authInstance = getAuth(appInstance);
  providerInstance = new GoogleAuthProvider();
  WORKSPACE_SCOPES.forEach(scope => providerInstance?.addScope(scope));
} catch (e) {
  console.warn('Firebase initialization error:', e);
}

export const auth = authInstance;

// The Google access token lives in memory, mirrored to sessionStorage (this tab only, cleared when
// the tab closes) so a reload doesn't sign you out. It is never written to localStorage.
const SESSION_TOKEN_KEY = 'sheetsync_oauth_token';
const SESSION_EXPIRES_KEY = 'sheetsync_token_expires';
// Google access tokens last 3600s; used when the sign-in response omits expires_in.
const DEFAULT_EXPIRES_IN_SECS = 3600;
// Treat the token as expired a minute early so requests in flight don't hit a 401.
const EXPIRY_SKEW_MS = 60 * 1000;

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
let isSigningIn = false;
let onExpired: (() => void) | null = null;

const isTokenUsable = () => !!cachedAccessToken && Date.now() < tokenExpiresAt - EXPIRY_SKEW_MS;

const clearToken = () => {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = null;
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_EXPIRES_KEY);
  } catch {
    // ignore
  }
};

const scheduleExpiry = () => {
  if (expiryTimer) clearTimeout(expiryTimer);
  const ms = tokenExpiresAt - EXPIRY_SKEW_MS - Date.now();
  expiryTimer = ms > 0 ? setTimeout(() => markTokenExpired(), ms) : null;
};

const setToken = (token: string, expiresInSecs: number) => {
  cachedAccessToken = token;
  tokenExpiresAt = Date.now() + expiresInSecs * 1000;
  try {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    sessionStorage.setItem(SESSION_EXPIRES_KEY, String(tokenExpiresAt));
  } catch {
    // ignore
  }
  scheduleExpiry();
};

const loadSessionToken = () => {
  if (cachedAccessToken) return;
  try {
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
    const expiresAt = parseInt(sessionStorage.getItem(SESSION_EXPIRES_KEY) || '', 10);
    if (token && Number.isFinite(expiresAt)) {
      cachedAccessToken = token;
      tokenExpiresAt = expiresAt;
      if (isTokenUsable()) scheduleExpiry();
      else clearToken();
    }
  } catch {
    // ignore
  }
};

/** Forget the access token (it expired or Google returned 401) and tell the app to show Reconnect. */
export const markTokenExpired = () => {
  const had = !!cachedAccessToken;
  clearToken();
  if (had && onExpired) onExpired();
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
  onTokenExpired?: () => void
) => {
  if (!authInstance) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
  onExpired = onTokenExpired ?? null;

  const unsubscribe = onAuthStateChanged(authInstance, async (user: User | null) => {
    if (user) {
      loadSessionToken();
      if (isTokenUsable() && cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        clearToken();
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      clearToken();
      if (onAuthFailure) onAuthFailure();
    }
  });
  return () => {
    onExpired = null;
    unsubscribe();
  };
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!authInstance || !providerInstance) {
    throw new Error('Authentication is not initialized');
  }

  try {
    isSigningIn = true;
    const result = await signInWithPopup(authInstance, providerInstance);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google sign in');
    }

    // Firebase exposes the OAuth response's expires_in as oauthExpireIn on the raw token response.
    const rawExpiresIn = Number((result as any)?._tokenResponse?.oauthExpireIn);
    setToken(credential.accessToken, Number.isFinite(rawExpiresIn) && rawExpiresIn > 0 ? rawExpiresIn : DEFAULT_EXPIRES_IN_SECS);
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    console.error('Google Sign-in failed:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = async () => {
  if (authInstance) {
    await signOut(authInstance);
  }
  clearToken();
};
