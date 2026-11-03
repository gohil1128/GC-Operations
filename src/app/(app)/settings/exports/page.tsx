import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireCapability } from "@/lib/scope";
import { EXPORTS, EXPORT_GROUPS } from "@/modules/exports/registry";

export const dynamic = "force-dynamic";

// Central download hub: every dataset the app holds, grouped, one click each.
// Datasets are read straight from the export registry, so a new export shows
// up here automatically.
//
// This page had no check of its own at all — it was only ever hidden from the
// nav for non-owners, which a typed URL walked straight past to every dataset
// in the business.
export default async function ExportsPage() {
  await requireCapability("settings");
  return (
    <div>
      <PageHeader
        eyebrow="Settings · Data export"
        title="Data export"
        description={`Download any of your ${EXPORTS.length} datasets as a CSV — opens in Excel, Numbers or Google Sheets`}
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8 space-y-8 animate-fade">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Transaction data (sales, invoices, cash, counts) covers your selected location; shared
          catalogs (ingredients, recipes, vendors, employees, events) cover the whole business.
          Amounts are plain numbers in dollars (no currency symbols) and dates are{" "}
          <span className="num">YYYY-MM-DD</span>, so they sort and pivot correctly in a spreadsheet.
        </p>

        {EXPORT_GROUPS.map((group) => {
          const items = EXPORTS.filter((e) => e.group === group);
          if (items.length === 0) return null;
          return (
            <section key={group} className="space-y-3">
              <h2 className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                {group}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((e) => (
                  <a
                    key={e.key}
                    href={`/api/exports/${e.key}`}
                    download
                    className="group flex items-start justify-between gap-3 bento p-4 transition-colors duration-200 hover:border-foreground/15"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-medium leading-tight">{e.label}</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{e.description}</p>
                      <div className="text-2xs text-muted-foreground num">{e.key}.csv</div>
                    </div>
                    <span className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors group-hover:bg-brand/10 group-hover:text-brand">
                      <Download className="h-4 w-4" />
                    </span>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
