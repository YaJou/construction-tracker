/** True if request cookies look like a Supabase auth session. */
export function hasSupabaseAuthCookie(
  cookies: { name: string }[] | { getAll(): { name: string }[] }
): boolean {
  const list = typeof (cookies as { getAll?: unknown }).getAll === "function"
    ? (cookies as { getAll(): { name: string }[] }).getAll()
    : (cookies as { name: string }[]);
  return list.some(
    (c) =>
      c.name.startsWith("sb-") &&
      (c.name.includes("auth-token") || c.name.endsWith("-auth-token"))
  );
}
