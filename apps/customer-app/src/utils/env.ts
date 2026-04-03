// src/utils/env.ts
// Centralized environment variable helpers — Supabase-first architecture (no Express backend)

/**
 * Require an environment variable to be set. Throws if missing.
 */
export function requireEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Validated Supabase project URL (must be HTTPS in production).
 */
function getSupabaseUrl(): string {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  if (!url) {
    throw new Error("VITE_SUPABASE_URL is not set. Supabase calls will fail.");
  }
  if (import.meta.env.PROD && !url.startsWith("https://")) {
    throw new Error(
      "VITE_SUPABASE_URL must use https:// in production to avoid insecure WebSocket errors."
    );
  }
  return url.replace(/\/$/, "");
}

const SUPABASE_URL = getSupabaseUrl();

/**
 * Call the unified `location` Supabase Edge Function.
 *
 * Usage:
 *   const data = await callLocationFn({ action: "distance", origin: "...", destination: "..." });
 */
export async function callLocationFn<T = any>(
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error ?? `Edge function returned HTTP ${res.status}`);
  }

  return data as T;
}
