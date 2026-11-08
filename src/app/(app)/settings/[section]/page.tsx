import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/scope";
import { SETTINGS } from "../_components/settings-index";
import { SettingsBack } from "../_components/settings-back";
import { SettingsSection } from "../_components/business-sections";
import { ConnectionSections } from "../integrations/_components/connection-sections";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Square "Sync now" and Gmail "Scan now" run here too

const BUSINESS = new Set(["business", "overview-cards", "cost-of-goods", "transparency", "locations", "events", "pin-lock", "danger-zone", "ai", "premix-cost"]);
const CONNECTIONS = new Set(["square", "email-invoices", "sales-summary-csv", "item-sales-csv", "imported-data", "items-categories"]);

// One setting on its own page, opened from the Settings list.
export default async function SettingPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ section }, sp] = await Promise.all([params, searchParams, requireCapability("settings")]);
  const entry = SETTINGS.find((s) => s.id === section);
  if (!entry || (!BUSINESS.has(section) && !CONNECTIONS.has(section))) notFound();
  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-4 sm:px-6">
      <SettingsBack title={entry.label} hint={entry.hint} />
      <div className="mt-4 grid gap-4">
        {BUSINESS.has(section) ? <SettingsSection only={section} /> : <ConnectionSections params={sp} only={section} />}
      </div>
    </div>
  );
}
