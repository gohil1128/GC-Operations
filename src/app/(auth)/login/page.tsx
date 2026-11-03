import { googleEnabled } from "@/lib/auth";
import { LoginForm } from "./login-form";

// What each error code from the Google sign-in means, in words.
const NOTICES: Record<string, string> = {
  GoogleUnverified: "Google hasn't verified that email address, so we can't sign you in with it. Verify it with Google, or use your password.",
  GoogleRateLimited: "Too many accounts have been created from here. Try again in an hour, or use your password.",
  GoogleFailed: "Signing in with Google didn't work. Try again, or use your password.",
  AccessDenied: "Google sign-in was cancelled. You can try again, or use your password.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams;
  const code = typeof p.error === "string" ? p.error : undefined;
  return <LoginForm googleEnabled={googleEnabled()} notice={code ? NOTICES[code] ?? (code === "Configuration" ? undefined : NOTICES.GoogleFailed) : undefined} />;
}
