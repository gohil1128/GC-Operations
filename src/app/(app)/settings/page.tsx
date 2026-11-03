import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Plug } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LocationsManager } from "./_components/locations-manager";
import { DangerZone } from "./_components/danger-zone";
import { BusinessForm } from "./_components/business-form";
import { OverviewCardsCard } from "./_components/overview-cards-card";
import { CostClassesCard } from "./_components/cost-classes-card";
import { GlassDensityCard } from "@/components/glass-density";
import { SectionLockCard } from "./_components/section-lock-card";
import { sectionLockSettings } from "@/modules/section-lock/actions";
import { EventsManager } from "./_components/events-manager";
import { Lock, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const scope = await requireCapability("settings");

  const [business, locations, events, counts, lockSettings] = await Promise.all([
    prisma.business.findUnique({ where: { id: scope.businessId } }),
    prisma.location.findMany({ where: { businessId: scope.businessId }, orderBy: { name: "asc" } }),
    prisma.event.findMany({ where: { businessId: scope.businessId }, orderBy: { startDate: "desc" } }),
    Promise.all([
      prisma.ingredient.count({ where: { businessId: scope.businessId } }),
      prisma.recipe.count({ where: { businessId: scope.businessId } }),
      prisma.supplier.count({ where: { businessId: scope.businessId } }),
      prisma.employee.count({ where: { businessId: scope.businessId } }),
      prisma.purchaseOrder.count({ where: { location: { businessId: scope.businessId } } }),
      prisma.dailySales.count({ where: { location: { businessId: scope.businessId } } }),
      prisma.cashClose.count({ where: { location: { businessId: scope.businessId } } }),
    ]).then(([ingredients, recipes, suppliers, employees, pos, sales, cashCloses]) => ({
      ingredients, recipes, suppliers, employees, pos, sales, cashCloses,
    })),
    sectionLockSettings(scope.businessId),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Settings · Business & events"
        title="Settings"
        description="Business, locations, users, and integrations"
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link href="/settings/users"><Users className="h-3.5 w-3.5" /> Users</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/settings/integrations"><Plug className="h-3.5 w-3.5" /> Integrations</Link></Button>
          </>
        }
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Business</CardTitle>
            <CardDescription>{business?.timezone} · {business?.currency} · created {business?.createdAt.toDateString() ?? "—"}</CardDescription>
          </CardHeader>
          <CardContent>
            {business && (
              <BusinessForm initial={{
                name: business.name,
                timezone: business.timezone,
                foodTargetPct: business.foodTargetPct,
                laborTargetPct: business.laborTargetPct,
                ebitdaMultiplier: business.ebitdaMultiplier,
                revenueMultiplier: business.revenueMultiplier,
              }} />
            )}
          </CardContent>
        </Card>

        {business && <OverviewCardsCard hidden={business.hiddenOverviewCards} />}

        {business && <CostClassesCard opex={business.opexInvoiceCategories} />}

        <GlassDensityCard />

        <Card>
          <CardHeader>
            <CardTitle>Locations</CardTitle>
            <CardDescription>Stores and event channels you operate</CardDescription>
          </CardHeader>
          <CardContent>
            <LocationsManager
              locations={locations.map((l) => ({ id: l.id, name: l.name, kind: l.kind, address: l.address }))}
              activeLocationId={scope.locationId}
              canDelete={locations.length > 1}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Section lock</CardTitle>
            <CardDescription>Hide P&amp;L, events or recipes behind a 4-digit PIN</CardDescription>
          </CardHeader>
          <CardContent>
            <SectionLockCard hasPin={lockSettings.hasPin} locked={lockSettings.locked} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Events</CardTitle>
            <CardDescription>Tag sales and closes with an event for dashboard analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <EventsManager events={events.map((e) => ({
              id: e.id, name: e.name, color: e.color,
              startDate: e.startDate.toISOString().slice(0, 10),
              endDate: e.endDate.toISOString().slice(0, 10),
              isActive: e.isActive,
              feeCents: e.feeCents ?? 0,
              feeNote: e.feeNote ?? "",
              notes: e.notes ?? "",
            }))} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Permanent actions. These can&apos;t be undone — read the dialog carefully.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DangerZone counts={counts} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
