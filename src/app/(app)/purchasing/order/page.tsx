import { requireCapability } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { todayIsoIn } from "@/lib/date";
import { PageHeader } from "@/components/page-header";
import { SectionTabs } from "@/components/shell/section-tabs";
import { listOrderableItems } from "@/modules/ordering/queries";
import { OrderPortal } from "./_components/order-portal";

export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const scope = await requireCapability("purchasing");
  const [items, business] = await Promise.all([
    listOrderableItems(scope.locationId, scope.businessId),
    prisma.business.findUnique({ where: { id: scope.businessId }, select: { name: true, timezone: true } }),
  ]);
  return (
    <div>
      <SectionTabs hub="invoices" role={scope.role} />
      <PageHeader eyebrow="Purchasing · Order" title="Order" description="Everything you have bought before. Set quantities, then share the order." />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-3 sm:px-6 lg:px-8">
        <OrderPortal items={items} businessName={business?.name ?? "Order"} todayIso={todayIsoIn(business?.timezone ?? "UTC")} />
      </div>
    </div>
  );
}
