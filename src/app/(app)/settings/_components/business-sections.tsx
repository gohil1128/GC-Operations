import { redirect } from "next/navigation";
import Link from "next/link";
import { requireCapability } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LocationsManager } from "./locations-manager";
import { DangerZone } from "./danger-zone";
import { BusinessForm } from "./business-form";
import { OverviewCardsCard } from "./overview-cards-card";
import { CostClassesCard } from "./cost-classes-card";
import { GlassDensityCard } from "@/components/glass-density";
import { SectionLockCard } from "./section-lock-card";
import { sectionLockSettings } from "@/modules/section-lock/actions";
import { EventsManager } from "./events-manager";
import { AiScanningCard } from "./ai-scanning-card";
import { Lock, Calendar } from "lucide-react";


/** One section of the business settings, rendered on its own page. */
export async function SettingsSection({ only }: { only: string }) {
  const show = (id: string) => only === id;
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
    sectionLockSettings(scope.userId),
  ]);

  return (
    <>
      {show("business") && (
        <Card id="business" data-settings-section>
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
      )}

        {show("overview-cards") && business && <OverviewCardsCard hidden={business.hiddenOverviewCards} />}

        {show("cost-of-goods") && business && <CostClassesCard opex={business.opexInvoiceCategories} />}

        {show("transparency") && <GlassDensityCard />}

        {show("ai") && business && <AiScanningCard enabled={business.aiScanningEnabled} />}

      {show("locations") && (
        <Card id="locations" data-settings-section>
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
      )}

      {show("pin-lock") && (
        <Card id="pin-lock" data-settings-section>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> My PIN lock</CardTitle>
            <CardDescription>Optional: hide P&amp;L, events or recipes on your own screen behind a 4-digit PIN</CardDescription>
          </CardHeader>
          <CardContent>
            <SectionLockCard hasPin={lockSettings.hasPin} locked={lockSettings.locked} />
          </CardContent>
        </Card>
      )}

      {show("events") && (
        <Card id="events" data-settings-section>
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
      )}

      {show("danger-zone") && (
        <Card id="danger-zone" data-settings-section className="border-destructive/30 xl:col-span-2">
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
      )}
    </>
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
