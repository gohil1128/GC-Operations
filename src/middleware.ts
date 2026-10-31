import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// The manifest and service-worker script MUST be publicly readable: a manifest
// is fetched with credentials omitted (so an auth redirect yields login HTML and
// the app becomes uninstallable), and a SW script request is redirect:"error"
// (so a 307 fails registration). Neither contains private data.
//
// Matched EXACTLY. A prefix test would make any future route starting with
// "/offline" or "/login" (e.g. /offline-report) silently public.
const PUBLIC_EXACT = new Set([
  "/login",
  // Creating an account cannot require an account.
  "/signup",
  "/forgot-password",
  // Reached by someone who cannot sign in, so it cannot require a session.
  // The token in the query string is the credential.
  "/reset-password",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline",
  "/api/auth",
]);
// Only NextAuth's own handler legitimately needs a subtree.
const PUBLIC_PREFIXES = ["/api/auth/"];

export default NextAuth(authConfig).auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (!req.auth) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest$|sw\\.js$|offline$|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
