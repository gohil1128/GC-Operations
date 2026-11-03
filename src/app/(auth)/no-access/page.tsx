import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthCard } from "../_components/auth-card";
import { SignOutButton } from "./_components/sign-out-button";

export const dynamic = "force-dynamic";

/*
  The account is real and the password was right, but it is attached to no
  location, so there is nothing for it to show. Reached by redirect from
  getScope(). Deliberately outside the app layout: that layout is what cannot
  render in this state.
*/
export default async function NoAccessPage() {
  const me = await currentUser();
  if (!me) redirect("/login");

  // If a location has since been granted, there is no reason to hold them here.
  const count = await prisma.userLocation.count({ where: { userId: me.id } });
  if (count > 0) redirect("/");

  return (
    <AuthCard
      title="Nothing assigned yet"
      description={
        <>
          You&apos;re signed in as {me.email}, but this account has not been given access to a
          location yet — so there is nothing here to show you. An owner can add you from
          Settings → Team. Sign out and back in once they have.
        </>
      }
    >
      <SignOutButton />
    </AuthCard>
  );
}
