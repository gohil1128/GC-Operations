import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCapability } from "@/lib/scope";
import { getUserProfile, listOtherUsers } from "@/modules/users/queries";
import { getReassignableCounts } from "@/modules/users/actions";
import { PageHeader } from "@/components/page-header";
import { StatTile, StatTileRow } from "@/components/stat-tile";
import { UserRowActions } from "../_components/user-row-actions";
import { ReassignCard } from "./_components/reassign-card";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/date";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/*
  One team member, in full: what's on their account (a set of real activity
  stats, not just name/role/joined) and, if it's not their own page, the one
  thing an owner actually comes here to do — hand their records to someone
  else before letting the account go.
*/
export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const scope = await requireCapability("settings");

  const { id } = await params;
  const profile = await getUserProfile(scope.businessId, id);
  if (!profile) notFound();

  const { user, stats } = profile;
  const isSelf = user.id === scope.userId;

  const [others, counts] = await Promise.all([
    listOtherUsers(scope.businessId, user.id),
    getReassignableCounts(user.id),
  ]);

  const locationNames = user.locations.map((l) => l.location.name).join(", ") || "No locations";

  return (
    <div>
      <PageHeader
        eyebrow={
          <Link href="/settings/users" className="hover:underline">
            Settings · Team
          </Link>
        }
        title={user.name}
        description={`${user.email} · ${ROLE_LABELS[user.role]} · joined ${fmtDate(user.createdAt)}${isSelf ? " · you" : ""}${user.mustChangePassword ? " · still on a temporary password" : ""}`}
        actions={
          <UserRowActions
            userId={user.id}
            userName={user.name}
            userEmail={user.email}
            currentRole={user.role}
            isSelf={isSelf}
          />
        }
      />

      <div className="mx-auto max-w-[1400px] space-y-5 px-4 pb-12 pt-5 sm:px-6 lg:px-8">
        <p className="text-xs text-muted-foreground">
          <span className="text-foreground">{ROLE_DESCRIPTIONS[user.role]}</span>
          {" · "}
          Locations: <span className="text-foreground">{locationNames}</span>
          {stats.lastActiveAt && (
            <>
              {" "}
              · last activity <span className="text-foreground">{fmtDate(stats.lastActiveAt)}</span>
            </>
          )}
        </p>

        <StatTileRow>
          <StatTile
            label="Invoices created"
            value={stats.invoicesCount.toLocaleString()}
            meta={stats.invoicesCount > 0 ? formatMoney(stats.invoicesTotalCents) : undefined}
          />
          <StatTile
            label="Expenses logged"
            value={stats.expensesCount.toLocaleString()}
            meta={stats.expensesCount > 0 ? formatMoney(stats.expensesTotalCents) : undefined}
          />
          <StatTile label="Purchase orders" value={stats.purchaseOrders.toLocaleString()} />
          <StatTile
            label="Capital purchases"
            value={stats.capitalAssetsCount.toLocaleString()}
            meta={stats.capitalAssetsCount > 0 ? formatMoney(stats.capitalAssetsTotalCents) : undefined}
          />
          <StatTile
            label="Cash closes"
            value={stats.cashClosesClosed.toLocaleString()}
            meta={stats.cashClosesVerified > 0 ? `+${stats.cashClosesVerified} verified` : undefined}
          />
          <StatTile label="Inventory counts" value={stats.inventoryCounts.toLocaleString()} />
        </StatTileRow>

        {!isSelf && (
          <ReassignCard fromUser={{ id: user.id, name: user.name }} counts={counts} others={others} />
        )}
      </div>
    </div>
  );
}
