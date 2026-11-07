import { SettingsHashReveal } from "./_components/settings-navigator";

// Settings is one searchable list (the /settings page); each setting opens on its
// own page. There is no tab strip any more: the list is the way around.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SettingsHashReveal />
      {children}
    </>
  );
}
