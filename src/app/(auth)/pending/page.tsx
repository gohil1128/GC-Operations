import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthCard } from "../_components/auth-card";
import { SignOutButton } from "../no-access/_components/sign-out-button";

export const dynamic = "force-dynamic";

/*
  Signed in with Google, asked to join, not approved yet. Deliberately outside
  the app layout, which is what sends them here and cannot render for them.
  Once an owner approves them there is nothing to hold them for.
*/
export default async function PendingPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.approved) redirect("/dashboard");

  const business = await prisma.business.findUnique({ where: { id: me.businessId }, select: { name: true } });

  return (
    <AuthCard
      title="Waiting for approval"
      description={
        <>
          You&apos;re signed in as {me.email}. Your request to join {business?.name ?? "this business"} has been
          sent to the owner. Nothing is visible to you until they approve it, so try again a little later, or
          ask them to open Settings → Users. Signing out and back in is all it takes once they have.
        </>
      }
    >
      <SignOutButton />
    </AuthCard>
  );
}
