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

export async function debugAuthState(tag: string, client: SupabaseClient = supabase): Promise<void> {
  const { data: { session } } = await client.auth.getSession();
  const snapshot = getStorageSnapshot();
  const ttlSeconds = sessionTTLSeconds(session);

  console.info(`[auth-debug:${tag}]`, {
    hasSession: !!session,
    userId: session?.user?.id || null,
    tokenPreview: maskToken(session?.access_token),
    tokenLength: session?.access_token?.length || 0,
    tokenTTLSeconds: ttlSeconds,
    expiresAt: session?.expires_at || null,
    expectedStorageKey: snapshot.expectedKey,
    expectedStorageKeyPresent: snapshot.expectedKeyPresent,
    authTokenKeys: snapshot.authTokenKeys,
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

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData?.user) {
    console.warn(`[auth-debug:${context}] getUser failed, trying refreshSession()`, userError?.message);
    await client.auth.refreshSession();
    const retry = await client.auth.getUser();
    if (retry.error || !retry.data?.user) {
      throw new Error("Authentication expired. Please log in again.");
    }
  }

  const finalSession = (await client.auth.getSession()).data.session;
  if (!finalSession?.access_token) {
    throw new Error("Missing access token. Please log in again.");
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
  console.info(`[auth-debug:${functionName}] invoke headers`, {
    hasAuthorizationHeader: !!headers.Authorization,
    authorizationPreview: maskToken(session.access_token),
  });

  const response = await supabase.functions.invoke<TData>(functionName, {
    ...options,
    headers,
  } as any);

  if (response.error) {
    console.error(`[auth-debug:${functionName}] invoke failed`, response.error);
  }

  return response as { data: TData | null; error: Error | null };
}

