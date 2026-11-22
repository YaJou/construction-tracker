import { isGuestAccessEnabled } from "@/lib/auth/guest";
import { hasRemoteDb } from "@/lib/remoteDb";

export type DbMode = "supabase" | "local";

declare global {
  // eslint-disable-next-line no-var
  var __stroiuchot_db_mode: DbMode | undefined;
  // eslint-disable-next-line no-var
  var __stroiuchot_db_checked_at: number | undefined;
}

const OK_TTL_MS = 60_000;
const FAIL_TTL_MS = 60 * 60_000; // dead host — don't re-probe for an hour
const PROBE_TIMEOUT_MS = 500;

export function isDbUnavailableMessage(message: string | undefined | null) {
  if (!message) return false;
  return /fetch failed|Failed to fetch|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|getaddrinfo|network|Load failed|TypeError|DNS|certificate|ssl|tls|UND_ERR|aborted/i.test(
    message
  );
}

/** Probe Supabase rarely; guest+Neon skips the dead host entirely. */
export async function resolveDbMode(): Promise<DbMode> {
  // Fast path: shared Neon + guest — never wait on dead Supabase
  if (isGuestAccessEnabled() && hasRemoteDb()) {
    globalThis.__stroiuchot_db_mode = "local";
    globalThis.__stroiuchot_db_checked_at = Date.now();
    return "local";
  }

  const now = Date.now();
  const cached = globalThis.__stroiuchot_db_mode;
  const checkedAt = globalThis.__stroiuchot_db_checked_at ?? 0;
  const ttl = cached === "local" ? FAIL_TTL_MS : OK_TTL_MS;
  if (cached && now - checkedAt < ttl) {
    return cached;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    globalThis.__stroiuchot_db_mode = "local";
    globalThis.__stroiuchot_db_checked_at = now;
    return "local";
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(`${url}/rest/v1/projects?select=id&limit=1`, {
      method: "GET",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    globalThis.__stroiuchot_db_mode = res.ok || res.status < 500 ? "supabase" : "local";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("supabase probe failed:", msg);
    globalThis.__stroiuchot_db_mode = "local";
  }

  globalThis.__stroiuchot_db_checked_at = now;
  return globalThis.__stroiuchot_db_mode!;
}

export function forceLocalDbMode() {
  globalThis.__stroiuchot_db_mode = "local";
  globalThis.__stroiuchot_db_checked_at = Date.now();
}
