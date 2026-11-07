import { getScope } from "@/lib/scope";
import { SectionTabs } from "@/components/shell/section-tabs";
import { SettingsHashReveal } from "./_components/settings-navigator";

// The pages of this hub as a tab strip on the phone (see components/shell/nav.ts).
export default async function Layout({ children }: { children: React.ReactNode }) {
  const scope = await getScope();
  return (
    <>
      <SectionTabs hub="settings" role={scope.role} />
      <SettingsHashReveal />
      {children}
    </>
  );
}
