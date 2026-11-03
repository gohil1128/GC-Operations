import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { homeFor } from "@/lib/permissions";
import { AuthCard } from "../_components/auth-card";
import { ChangePasswordForm } from "./_components/change-password-form";

export const dynamic = "force-dynamic";

/*
  Two arrivals, one page: somebody sent here by the app because they are still
  on a password an owner chose for them, and somebody who simply wants to
  change theirs. The copy and the way out differ; the form does not.
*/
export default async function ChangePasswordPage() {
  const me = await currentUser();
  if (!me) redirect("/login");

  const forced = me.mustChangePassword;

  return (
    <AuthCard
      title={forced ? "Choose your password" : "Change your password"}
      description={
        forced ? (
          <>
            You are signed in with a password someone else set for you. Pick your own to
            carry on — it is the only thing standing between this account and whoever else
            saw that temporary one.
          </>
        ) : (
          <>Signed in as {me.email}.</>
        )
      }
      footer={forced ? undefined : <a href={homeFor(me.role)} className="hover:underline">Back to the app</a>}
    >
      <ChangePasswordForm forced={forced} returnTo={homeFor(me.role)} />
    </AuthCard>
  );
}
