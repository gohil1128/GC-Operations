import { requireCapability } from "@/lib/scope";
import { PageHeader } from "@/components/page-header";
import { SettingsNavigator } from "./_components/settings-navigator";

export const dynamic = "force-dynamic";

/*
  Settings home: just the navigator. Every setting opens on its own page
  (settings/[section]), so this screen is a short, searchable list instead of
  every form at once.
*/
export default async function SettingsPage() {
  await requireCapability("settings");
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Settings" description="Search, or pick a setting" />
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-5 sm:px-6">
        <SettingsNavigator />
      </div>
    </div>
  );
}

