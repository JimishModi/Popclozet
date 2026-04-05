import { supabase } from "@popclozet/api-client";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

type InvokeOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  [key: string]: unknown;
};

type StorageSnapshot = {
  expectedKey: string | null;
  expectedKeyPresent: boolean;
  authTokenKeys: string[];
};

type JwtClaims = {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  role?: string;
  exp?: number;
  iat?: number;
};

const ACCESS_TOKEN_MASK_HEAD = 12;
const ACCESS_TOKEN_MASK_TAIL = 6;
const REFRESH_WINDOW_SECONDS = 60;

function getExpectedStorageKey(): string | null {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (!url) return null;
    const host = new URL(url).hostname;
    const projectRef = host.split(".")[0];
    if (!projectRef) return null;
    return `sb-${projectRef}-auth-token`;
  } catch {
    return null;
  }
}

function getStorageSnapshot(): StorageSnapshot {
  if (typeof window === "undefined") {
    return { expectedKey: null, expectedKeyPresent: false, authTokenKeys: [] };
  }

  const expectedKey = getExpectedStorageKey();
  const authTokenKeys: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.endsWith("-auth-token")) authTokenKeys.push(key);
  }

  return {
    expectedKey,
    expectedKeyPresent: !!(expectedKey && localStorage.getItem(expectedKey)),
    authTokenKeys,
  };
}

function maskToken(token: string | null | undefined): string {
  if (!token) return "none";
  if (token.length <= ACCESS_TOKEN_MASK_HEAD + ACCESS_TOKEN_MASK_TAIL) return "[short-token]";
  return `${token.slice(0, ACCESS_TOKEN_MASK_HEAD)}...${token.slice(-ACCESS_TOKEN_MASK_TAIL)}`;
}

function sessionTTLSeconds(session: Session | null): number | null {
  if (!session?.expires_at) return null;
  return session.expires_at - Math.floor(Date.now() / 1000);
}

function parseJwtClaims(token: string | null | undefined): JwtClaims | null {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = atob(padded);
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

function projectRefFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function projectRefFromIssuer(iss: string | undefined): string | null {
  if (!iss) return null;
  try {
    return new URL(iss).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

function anonKeyProjectRef(): string | null {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const claims = parseJwtClaims(anonKey);
  return projectRefFromIssuer(claims?.iss);
}

export async function debugAuthState(tag: string, client: SupabaseClient = supabase): Promise<void> {
  const { data: { session } } = await client.auth.getSession();
  const snapshot = getStorageSnapshot();
  const ttlSeconds = sessionTTLSeconds(session);
  const claims = parseJwtClaims(session?.access_token);
  const configuredProjectRef = projectRefFromUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
  const tokenProjectRef = projectRefFromIssuer(claims?.iss);
  const anonProjectRef = anonKeyProjectRef();

  console.warn(`[auth-debug:${tag}]`, {
    hasSession: !!session,
    userId: session?.user?.id || null,
    tokenPreview: maskToken(session?.access_token),
    tokenLength: session?.access_token?.length || 0,
    tokenTTLSeconds: ttlSeconds,
    expiresAt: session?.expires_at || null,
    expectedStorageKey: snapshot.expectedKey,
    expectedStorageKeyPresent: snapshot.expectedKeyPresent,
    authTokenKeys: snapshot.authTokenKeys,
    configuredProjectRef,
    anonKeyProjectRef: anonProjectRef,
    tokenProjectRef,
    tokenAud: claims?.aud || null,
    tokenSub: claims?.sub || null,
    tokenRole: claims?.role || null,
    tokenExp: claims?.exp || null,
  });
}

async function ensureValidUserSession(client: SupabaseClient, context: string): Promise<Session> {
  let { data: { session } } = await client.auth.getSession();

  if (!session) {
    console.warn(`[auth-debug:${context}] No cached session, trying refreshSession()`);
    await client.auth.refreshSession();
    session = (await client.auth.getSession()).data.session;
  }

  if (!session) {
    throw new Error("No active session. Please log in again.");
  }

  const ttl = sessionTTLSeconds(session);
  if (typeof ttl === "number" && ttl <= REFRESH_WINDOW_SECONDS) {
    console.warn(`[auth-debug:${context}] Session expiring in ${ttl}s, refreshing`);
    await client.auth.refreshSession();
    session = (await client.auth.getSession()).data.session;
  }

  // Validate the exact token we'll send (not just "current auth state")
  let { data: userData, error: userError } = await client.auth.getUser(session.access_token);
  if (userError || !userData?.user) {
    console.warn(
      `[auth-debug:${context}] getUser(access_token) failed, trying refreshSession()`,
      userError?.message
    );
    await client.auth.refreshSession();
    const refreshedSession = (await client.auth.getSession()).data.session;
    if (!refreshedSession?.access_token) {
      throw new Error("Authentication expired. Please log in again.");
    }
    session = refreshedSession;
    const retry = await client.auth.getUser(session.access_token);
    if (retry.error || !retry.data?.user) {
      throw new Error("Authentication expired. Please log in again.");
    }
    userData = retry.data;
  }

  const finalSession = (await client.auth.getSession()).data.session ?? session;
  if (!finalSession?.access_token) {
    throw new Error("Missing access token. Please log in again.");
  }

  const claims = parseJwtClaims(finalSession.access_token);
  const configuredProjectRef = projectRefFromUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
  const anonProjectRef = anonKeyProjectRef();
  const tokenProjectRef = projectRefFromIssuer(claims?.iss);

  if (configuredProjectRef && anonProjectRef && configuredProjectRef !== anonProjectRef) {
    throw new Error(
      `Supabase env mismatch: URL project=${configuredProjectRef}, ANON key project=${anonProjectRef}. ` +
      "Fix Vercel env vars so VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are from the same project."
    );
  }

  if (!claims?.sub || !claims?.role) {
    throw new Error("Invalid user JWT (missing required claims). Please log in again.");
  }

  if (claims.role === "anon") {
    throw new Error("Anonymous token detected. Please sign in again.");
  }

  if (configuredProjectRef && tokenProjectRef && configuredProjectRef !== tokenProjectRef) {
    throw new Error(
      `JWT project mismatch: token=${tokenProjectRef}, client=${configuredProjectRef}. ` +
      "Check Vercel Supabase URL/keys and clear stale session."
    );
  }

  if (userData?.user?.id && claims.sub !== userData.user.id) {
    throw new Error("JWT user mismatch detected. Please sign in again.");
  }

  return finalSession;
}

export async function invokeWithUserJwt<TData = unknown>(
  functionName: string,
  options: InvokeOptions = {},
): Promise<{ data: TData | null; error: Error | null }> {
  const session = await ensureValidUserSession(supabase, functionName);

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${session.access_token}`,
  };

  await debugAuthState(`before-invoke:${functionName}`);
  console.warn(`[auth-debug:${functionName}] invoke headers`, {
    hasAuthorizationHeader: !!headers.Authorization,
    authorizationPreview: maskToken(session.access_token),
  });

  const response = await supabase.functions.invoke<TData>(functionName, {
    ...options,
    headers,
  } as any);

  if (response.error) {
    const err: any = response.error;
    const status = err?.context?.status ?? null;
    console.error(`[auth-debug:${functionName}] invoke failed`, {
      status,
      message: err?.message || String(err),
      hint: status === 401
        ? 'JWT mismatch at gateway: compare configuredProjectRef, anonKeyProjectRef, tokenProjectRef logs.'
        : undefined,
    });
  }

  return response as { data: TData | null; error: Error | null };
}
