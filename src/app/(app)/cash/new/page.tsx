import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCashCloseByDate, getSalesForDate, listDepositsForDate, listPayoutsForDate } from "@/modules/cash/queries";
import { listActiveEvents, getActiveEvent } from "@/modules/events/queries";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { fromCents } from "@/lib/money";
import { fmtBusinessDate, todayIsoIn, safeDateParam, businessDayFromIso, isoFromBusinessDay } from "@/lib/date";
import { CashEntry } from "../_components/cash-entry";

export const dynamic = "force-dynamic";

export default async function NewClosePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const scope = await requireCapability("cash");

  /*
    "Today" means today where the business trades, not where the server runs.

    This was new Date().toISOString(), which is the server's UTC date. Production
    runs UTC and the business is in Toronto, so from 8pm EDT the default jumped
    to tomorrow — and an evening market's cash close was filed under the next
    day, where it did not line up with that day's sales and would collide with
    the next real close on the (locationId, businessDate) unique key.
  */
  const business = await prisma.business.findUnique({
    where: { id: scope.businessId },
    select: { timezone: true },
  });
  const dateStr = safeDateParam(sp.date) ?? todayIsoIn(business?.timezone ?? "UTC");
  const [sales, existing, deposits, payouts, events, activeEvent] = await Promise.all([
    getSalesForDate(scope.locationId, dateStr),
    getCashCloseByDate(scope.locationId, dateStr),
    listDepositsForDate(scope.locationId, dateStr),
    listPayoutsForDate(scope.locationId, dateStr),
    listActiveEvents(scope.businessId),
    getActiveEvent(scope.businessId),
  ]);

  // Stepped in UTC to match how the day is stored. date-fns addDays works in
  // local time, so off a non-UTC server Prev/Next could land on the same day
  // twice or skip one across a DST boundary.
  const day = businessDayFromIso(dateStr);
  const prev = isoFromBusinessDay(new Date(day.getTime() - 86_400_000));
  const next = isoFromBusinessDay(new Date(day.getTime() + 86_400_000));

  return (
    <div>
      <PageHeader
        eyebrow="Cash · New close"
        title="Daily entry"
        description={`${scope.locationName} · ${fmtBusinessDate(dateStr)}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link href={`/cash/new?date=${prev}`}>‹ Prev</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href={`/cash/new?date=${next}`}>Next ›</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/cash"><ArrowLeft className="h-3.5 w-3.5" /> All closes</Link></Button>
          </>
        }
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <CashEntry
          businessDate={dateStr}
          locationName={scope.locationName}
          netSalesDollars={sales ? fromCents(sales.netSalesCents) : 0}
          events={events.map((e) => ({ id: e.id, name: e.name, color: e.color }))}
          activeEventId={activeEvent?.id ?? null}
          canVerify={can(scope.role, "cashVerify")}
          existing={existing ? {
            id: existing.id,
            openingDollars: fromCents(existing.openingCents),
            closingDollars: fromCents(existing.closingCents),
            cashDollars: fromCents(existing.cashCents),
            creditDollars: fromCents(existing.creditCents),
            safeCountDollars: fromCents(existing.safeCountCents),
            paidInDollars: fromCents(existing.paidInCents),
            paidOutDollars: fromCents(existing.paidOutCents),
            expectedDollars: fromCents(existing.expectedCents),
            overShortDollars: fromCents(existing.overShortCents),
            weather: existing.weather ?? "",
            specialEvents: existing.specialEvents ?? "",
            eventId: existing.eventId,
            notes: existing.notes ?? "",
            closedByName: existing.closedBy.name,
            verifiedByName: existing.verifiedBy?.name ?? null,
            verifiedAt: existing.verifiedAt?.toISOString() ?? null,
            createdAt: existing.createdAt.toISOString(),
          } : null}
          deposits={deposits.map((d) => ({
            id: d.id,
            sequence: d.sequence,
            amountDollars: fromCents(d.amountCents),
            bagCode: d.bagCode,
            preparedBy: d.preparedBy,
            notes: d.notes,
          }))}
          payouts={payouts.map((p) => ({
            id: p.id,
            amountDollars: fromCents(p.amountCents),
            kind: p.kind,
            reason: p.reason,
            paidTo: p.paidTo,
            reference: p.reference,
          }))}
        />
      </div>
    </div>
  );
}

