import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/scope";
import { listActiveEvents } from "@/modules/events/queries";
import { listImportedDays } from "@/modules/imports/queries";
import { listItemCatalog } from "@/modules/items/queries";
import { listItemRecipeLinks } from "@/modules/items/costing";
import { listRecipes } from "@/modules/recipes/queries";
import { fmtDate } from "@/lib/date";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SquareSalesSummaryImporter } from "./_components/square-sales-summary-importer";
import { SquareItemSummaryImporter } from "./_components/square-item-summary-importer";
import { ImportedDataManager } from "./_components/imported-data-manager";
import { ItemsManager } from "./_components/items-manager";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const scope = await requireCapability("settings");
  const events = await listActiveEvents(scope.businessId);
  const eventProps = events.map((e) => ({ id: e.id, name: e.name, color: e.color }));
  const broadway = events.find((e) => /broadway/i.test(e.name));
  const defaultEventId = broadway?.id;

  const importedDays = await listImportedDays(scope.locationId);
  const [itemCatalog, itemLinks, recipes] = await Promise.all([
    listItemCatalog(scope.locationId),
    listItemRecipeLinks(scope.locationId),
    listRecipes(scope.businessId),
  ]);
  const linkByName = new Map(itemLinks.map((l) => [l.itemName, l.recipeId]));
  const itemRows = itemCatalog.map((i) => ({
    itemName: i.itemName,
    category: i.category,
    qty: i.qty,
    netSalesDollars: i.netSalesCents / 100,
    dayCount: i.dayCount,
    recipeId: linkByName.get(i.itemName) ?? null,
  }));
  // Plate cost is the whole batch; what a sold unit costs is that over the
  // recipe's yield, which is the number worth showing next to a menu item.
  const recipeOptions = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    unitCostCents: Math.round(r.plateCostCents / (r.yieldQty > 0 ? r.yieldQty : 1)),
  }));
  const managerDays = importedDays.map((d) => ({
    iso: d.iso,
    label: fmtDate(d.businessDate),
    netSalesDollars: d.netSalesCents / 100,
    guestCount: d.guestCount,
    itemCount: d.itemCount,
    itemQty: d.itemQty,
    source: d.source,
    event: d.event,
  }));
  // Group imported days by event for the quick-delete chips.
  const eventGroupMap = new Map<string, { id: string; name: string; color: string | null; days: number; netDollars: number }>();
  for (const d of importedDays) {
    if (!d.event) continue;
    const g = eventGroupMap.get(d.event.id) ?? { id: d.event.id, name: d.event.name, color: d.event.color, days: 0, netDollars: 0 };
    g.days += 1;
    g.netDollars += d.netSalesCents / 100;
    eventGroupMap.set(d.event.id, g);
  }
  const eventGroups = [...eventGroupMap.values()];

  return (
    <div>
      <PageHeader eyebrow="Settings · Integrations" title="Integrations" description="Upload Square's Sales Summary and Item Sales Summary CSVs · external APIs are wired as placeholders" />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card className="border-brand/50">
          <CardHeader>
            <CardTitle>
              Square Sales Summary CSV
              <Badge variant="success" className="ml-2">Live</Badge>
              <Badge variant="brand" className="ml-2">Recommended</Badge>
            </CardTitle>
            <CardDescription>
              Upload Square&apos;s <em>Sales Summary</em> page export — the one-day report with
              <strong> Net sales, Tips, Taxes, Cash, Card</strong> and total transactions. Pick the
              business date (auto-guessed from the filename); we&apos;ll create the daily totals AND
              pre-fill that day&apos;s cash close split.
              {broadway && <span className="block mt-1 text-brand">Defaults to your &quot;{broadway.name}&quot; event.</span>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SquareSalesSummaryImporter events={eventProps} defaultEventId={defaultEventId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Square Item Sales Summary CSV
              <Badge variant="success" className="ml-2">Live</Badge>
            </CardTitle>
            <CardDescription>
              Upload Square&apos;s <em>Item Sales</em> export — one row per item with totals for
              the day. Pick the business date; we&apos;ll create per-item rows so the dashboard
              shows what sold and roll them up into a DailySales record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SquareItemSummaryImporter events={eventProps} defaultEventId={defaultEventId} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Manage imported data <Badge variant="muted" className="ml-2">Delete</Badge></CardTitle>
            <CardDescription>
              Every imported sales day at this location. Delete a single day, wipe a whole event,
              or clear everything to re-import from scratch. Deleting here removes sales totals and
              item rollups (your events themselves stay).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportedDataManager days={managerDays} eventGroups={eventGroups} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items &amp; categories <Badge variant="brand" className="ml-2">Categorize</Badge></CardTitle>
            <CardDescription>
              Every item from your imported sales. Assign each one to a category — Hot Chai,
              Cold Chais, Food, Tips, or Other — and the dashboard&apos;s category breakdown updates
              automatically. Items that came in as &quot;Uncategorized&quot; or &quot;Custom Amount&quot;
              default to <strong>Other</strong>. You can also delete an item&apos;s sales here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ItemsManager items={itemRows} recipes={recipeOptions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Square POS sync <Badge variant="muted" className="ml-2">Coming soon</Badge></CardTitle>
            <CardDescription>Direct OAuth sync (no CSV upload needed) — requires Square developer approval</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm" disabled>Connect Square</Button>
            <Button variant="outline" size="sm" disabled>Connect Toast</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>QuickBooks export <Badge variant="muted" className="ml-2">Placeholder</Badge></CardTitle>
            <CardDescription>Push sales + purchase data into QuickBooks Online</CardDescription>
          </CardHeader>
          <CardContent><Button variant="outline" size="sm" disabled>Connect QuickBooks</Button></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payroll export <Badge variant="muted" className="ml-2">Placeholder</Badge></CardTitle>
            <CardDescription>Export hours into Gusto or ADP</CardDescription>
          </CardHeader>
          <CardContent><Button variant="outline" size="sm" disabled>Connect Gusto</Button></CardContent>
        </Card>
      </div>
    </div>
  );
}
