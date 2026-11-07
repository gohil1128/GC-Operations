import { PageHeader } from "@/components/page-header";
import { ConnectionSections } from "./_components/connection-sections";

export const dynamic = "force-dynamic";
// "Sync now" and "Scan now" are server actions, and run inside this page's
// function, so they get this page's time limit. Both budget themselves well
// inside a minute; the platform default would cut them off first.
export const maxDuration = 60;

// Every connection on one page. OAuth callbacks (Square, Gmail) return here.
export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <div>
      <PageHeader eyebrow="Settings · Connections" title="Connections" description="Square sales and emailed invoices, brought in on their own" />
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 px-4 pb-10 pt-5 sm:px-6 lg:grid-cols-2 lg:px-8">
        <ConnectionSections params={params} />
      </div>
    </div>
  );
}
