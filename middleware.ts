import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isGuestAccessEnabled } from "@/lib/auth/guest";
import { hasSupabaseAuthCookie } from "@/lib/auth/sessionCookie";

const PUBLIC_PATHS = ["/", "/login"];
const PUBLIC_PREFIXES = ["/api/health"];

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  return false;
}

function isAppPath(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/api/")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const guestOk = isGuestAccessEnabled();
  const hasSessionCookie = hasSupabaseAuthCookie(request.cookies);

  // Guest mode without a login cookie — skip dead Supabase auth round-trip
  if (guestOk && !hasSessionCookie) {
    if (isPublic(pathname) && !pathname.startsWith("/api/")) {
      return NextResponse.next({ request });
    }
    if (isAppPath(pathname)) {
      return NextResponse.next({ request });
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  let user: { id: string } | null = null;

  try {
    const session = await updateSession(request);
    supabaseResponse = session.supabaseResponse;
    user = session.user;
  } catch (e) {
    // Supabase auth can fail with "Load failed" — don't block the app in guest mode
    console.warn("middleware session:", e);
  }

  if (isPublic(pathname) && !pathname.startsWith("/api/")) {
    if (pathname === "/login" && user) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (isAppPath(pathname) && !user) {
    if (guestOk) {
      return supabaseResponse;
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|woff2?)$).*)",
  ],
};
