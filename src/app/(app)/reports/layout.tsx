import { PageHeader } from "@/components/page-header";
import { requireCapability } from "@/lib/scope";
import { isSectionLocked } from "@/modules/section-lock/actions";
import { SectionPinGate } from "@/components/section-pin-gate";

export const dynamic = "force-dynamic";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  /*
    Capability first, PIN second.

    The lock check used to run before any capability check, so a STAFF member
    — who can never see this section whatever they type — was shown "Enter the
    4-digit PIN", implying access was one PIN away. No data leaked, because the
    page inside still gates, but it advertised a door that does not exist and
    made redirect behaviour depend on whether a section happened to be locked.
    requireCapability redirects them home before the PIN is ever mentioned.
  */
  const scope = await requireCapability("financials");
  if (await isSectionLocked(scope.userId, "REPORTS")) {
    return (
      <div>
        <PageHeader title="Profit & loss" description="Locked with your PIN" />
        <SectionPinGate
          title="Profit & loss is locked"
          blurb="You locked this with your own PIN. Enter it to view margins, spend and the event breakdowns."
        />
      </div>
    );
  }
  return <>{children}</>;
}
