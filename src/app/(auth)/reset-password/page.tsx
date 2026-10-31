import Link from "next/link";
import { checkResetToken } from "@/modules/auth/password";
import { AuthCard } from "../_components/auth-card";
import { ResetPasswordForm } from "./_components/reset-password-form";

export const dynamic = "force-dynamic";

const REFUSALS = {
  invalid: "That link is not one we issued. Check you copied all of it.",
  expired: "That link has expired — they last an hour.",
  used: "That link has already been used. If it was not you, ask an owner to reset your password.",
} as const;

/*
  Reached signed OUT, from a link in an email or handed over by an owner. The
  token is checked here so a dead link says so immediately rather than after
  somebody has typed a new password twice.
*/
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const check = await checkResetToken(token);

  if (!check.ok) {
    return (
      <AuthCard
        title="This link no longer works"
        description={REFUSALS[check.reason]}
        footer={<Link href="/forgot-password" className="hover:underline">Request a new link</Link>}
      >
        <Link
          href="/forgot-password"
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-espresso text-sm font-medium text-espresso-foreground"
        >
          Send me a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description={<>For {check.email}. This link works once and expires in an hour.</>}
      footer={<Link href="/login" className="hover:underline">Back to sign in</Link>}
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
