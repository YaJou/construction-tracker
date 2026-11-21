export type DbMode = "supabase" | "local";

declare global {
  // eslint-disable-next-line no-var
  var __stroiuchot_db_mode: DbMode | undefined;
  // eslint-disable-next-line no-var
  var __stroiuchot_db_checked_at: number | undefined;
}

const CHECK_TTL_MS = 60_000;

export function isDbUnavailableMessage(message: string | undefined | null) {
  if (!message) return false;
  return /fetch failed|Failed to fetch|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|getaddrinfo|network|Load failed|TypeError|DNS|certificate|ssl|tls|UND_ERR|aborted/i.test(
    message
  );
}

/** Probe Supabase once per minute; on failure use local JSON store. */
export async function resolveDbMode(): Promise<DbMode> {
  const now = Date.now();
  if (
    globalThis.__stroiuchot_db_mode &&
    globalThis.__stroiuchot_db_checked_at &&
    now - globalThis.__stroiuchot_db_checked_at < CHECK_TTL_MS
  ) {
    return globalThis.__stroiuchot_db_mode;
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
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${url}/rest/v1/projects?select=id&limit=1`, {
      method: "GET",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    // Any HTTP response means the host is reachable
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
