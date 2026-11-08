import { redirect } from "next/navigation";
import { auth, currentUser } from "@/lib/auth";
import { getScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { relativeDay } from "@/lib/date";
import { lockedSectionsNow } from "@/modules/section-lock/actions";
import { getActiveEvent, listActiveEvents } from "@/modules/events/queries";
import { countOpenInvoices } from "@/modules/invoices/queries";
import { findUncountedDrawers, lastPosImportAt } from "@/modules/cash/queries";
import { BrandBar } from "@/components/shell/brand-bar";
import { LocationSwitcher } from "@/components/shell/location-switcher";
import { EventSwitcher } from "@/components/shell/event-switcher";
import { UserMenu } from "@/components/shell/user-menu";
import { PageTransition } from "@/components/shell/page-transition";
import { RouteProgress } from "@/components/shell/route-progress";
import { ExportInterceptor } from "@/components/export-interceptor";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { Sidebar } from "@/components/shell/sidebar";
import { HeaderHeightVar } from "@/components/shell/header-height";
import { StickyHeader } from "@/components/shell/sticky-header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  /*
    One chokepoint for the temporary-password rule: every page in the app is
    inside this layout, so a password somebody else chose gets you exactly as
    far as choosing your own. Enforced here rather than in middleware because
    the flag is read from the row — it is cleared the instant they set a
    password, and a token would still be carrying the old value.
  */
  const me = await currentUser();
  if (!me) redirect("/login");
  // Asked to join through Google and not yet approved by an owner.
  if (!me.approved) redirect("/pending");
  if (me.mustChangePassword) redirect("/change-password");

  const scope = await getScope();
  const [business, lockedSections, events, activeEvent, openInvoices, uncounted, posImport] =
    await Promise.all([
      prisma.business.findUnique({ where: { id: scope.businessId }, select: { name: true } }),
      lockedSectionsNow(scope.userId),
      listActiveEvents(scope.businessId),
      getActiveEvent(scope.businessId),
      countOpenInvoices(scope.locationId),
      findUncountedDrawers(scope.locationId),
      lastPosImportAt(scope.locationId),
    ]);
  const activeLocation = scope.availableLocations.find((l) => l.id === scope.locationId)!;

  return (
    <div className="flex min-h-screen">
      {/* The material's runtime: the lens filter every glass surface refracts
          through, the capability probe that decides whether this engine can
          run it, and the single pointer listener that moves the light. Mounted
          once, here, because all three are page-wide. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-highlight focus:px-4 focus:py-2 focus:text-sm focus:text-highlight-foreground"
      >
        Skip to main content
      </a>
      {/* The v3 sidebar at lg+, MobileTabBar below it. It is a real column in
          the flex row now rather than a floating element the content had to
          leave a hole for, so there is no inset to keep in step with its
          width. */}
      <Sidebar
        role={scope.role}
        userName={session.user.name ?? "User"}
        userEmail={session.user.email ?? ""}
        locationName={activeLocation.name}
        openInvoices={openInvoices}
        hasUncountedDrawer={uncounted.count > 0}
        squareLastImport={posImport ? relativeDay(posImport) : null}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Content top strip. On a phone: the switchers (when there are any) on
            the left, the logo in the middle, the account button on the right,
            each control a round glass button. From lg up the sidebar carries the
            logo and the account, and only the switchers stay, at the right. */}
        <StickyHeader>
          <div className="mx-auto grid w-full max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2 sm:px-6 lg:flex lg:justify-end lg:gap-3 lg:px-8 lg:py-3">
            <div className="flex min-w-0 items-center justify-start gap-2 lg:gap-1.5">
              <LocationSwitcher active={activeLocation} options={scope.availableLocations} />
              <EventSwitcher events={events} activeEventId={activeEvent?.id ?? null} />
            </div>
            <div className="lg:hidden">
              <BrandBar businessName={business?.name ?? "Operations"} />
            </div>
            {/* lg:hidden: at desktop widths the sidebar's user card is this same
                menu, and two triggers for one menu on one screen is the
                duplication the sidebar was meant to end. */}
            <div className="flex justify-end lg:hidden">
              <UserMenu
                name={session.user.name ?? "User"}
                email={session.user.email ?? ""}
                role={scope.role}
                locationName={activeLocation.name}
              />
            </div>
          </div>
        </StickyHeader>

        <main id="main" tabIndex={-1} className="relative z-10 flex-1 pb-tabbar outline-none lg:pb-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <ExportInterceptor />
      <RouteProgress />
      <HeaderHeightVar />
      <MobileTabBar role={scope.role} />
    </div>
  );
}
