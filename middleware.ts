import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PATHS = ["/", "/login"];
const PUBLIC_PREFIXES = ["/api/health"];

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  // Landing assets / next internals
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

  // Always refresh session cookies when possible
  const { supabaseResponse, user } = await updateSession(request);

  if (isPublic(pathname) && !pathname.startsWith("/api/")) {
    // Logged-in user on /login → dashboard
    if (pathname === "/login" && user) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (isAppPath(pathname) && !user) {
    // API → 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Требуется вход" },
        { status: 401 }
      );
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
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
