import { redirect } from "next/navigation";
import { auth, currentUser } from "@/lib/auth";
import { getScope } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { lockedSectionsNow } from "@/modules/section-lock/actions";
import { getActiveEvent, listActiveEvents } from "@/modules/events/queries";
import { countOpenInvoices } from "@/modules/invoices/queries";
import { BrandBar } from "@/components/shell/brand-bar";
import { LocationSwitcher } from "@/components/shell/location-switcher";
import { EventSwitcher } from "@/components/shell/event-switcher";
import { UserMenu } from "@/components/shell/user-menu";
import { PageTransition } from "@/components/shell/page-transition";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { IconRail } from "@/components/shell/icon-rail";
import { HeaderHeightVar } from "@/components/shell/header-height";
import { LiquidGlass } from "@/components/liquid-glass";

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
  if (me.mustChangePassword) redirect("/change-password");

  const scope = await getScope();
  const [business, lockedSections, events, activeEvent, openInvoices] = await Promise.all([
    prisma.business.findUnique({ where: { id: scope.businessId }, select: { name: true } }),
    lockedSectionsNow(scope.businessId),
    listActiveEvents(scope.businessId),
    getActiveEvent(scope.businessId),
    countOpenInvoices(scope.locationId),
  ]);
  const activeLocation = scope.availableLocations.find((l) => l.id === scope.locationId)!;

  return (
    <div className="flex min-h-screen">
      {/* The material's runtime: the lens filter every glass surface refracts
          through, the capability probe that decides whether this engine can
          run it, and the single pointer listener that moves the light. Mounted
          once, here, because all three are page-wide. */}
      <LiquidGlass />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-espresso focus:px-4 focus:py-2 focus:text-sm focus:text-espresso-foreground"
      >
        Skip to main content
      </a>
      {/* Soft glass: a floating frosted rail at lg+, MobileTabBar below it. */}
      <IconRail role={scope.role} userName={session.user.name ?? "User"} />

      {/* 18px gutter + the 88px rail + 14px = the inset the floating rail needs.
          It grew with the rail when the destinations gained visible names. */}
      <div className="relative flex min-w-0 flex-1 flex-col lg:pl-[120px]">
        {/* Content top strip: scope on the left, switchers on the right.
            Transparent now — it floats over the photograph, and the pieces
            inside it carry their own frosted pills. */}
        <header className="relative z-30 sticky top-0 pt-safe">
          <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3 lg:px-8">
            {/* The logo lives in the sidebar on web, so show it here only on mobile. */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="lg:hidden">
                <BrandBar businessName={business?.name ?? "Operations"} />
              </div>
              {/*
                The business name, and nothing else.

                This pill used to read "God's Chai Operations · Downtown Cafe ·
                All events", and the location switcher and the event switcher
                sit 200px to the right of it saying "Downtown Cafe" and "All
                events". So two thirds of the line was repeating, in text you
                cannot act on, what the controls next to it already show and
                can change. On the Overview the same event name then appeared
                twice more — in the masthead title and on its own period
                control — four times on one screen.

                What is left is the one thing the switchers never show, which
                is also the only orientation this strip owes anybody on
                desktop, where the rail's logo is a mark with no words.
              */}
              <span className="glass-pill hidden truncate rounded-full px-3.5 py-1.5 text-[13px] text-secondary-foreground lg:inline">
                {business?.name ?? "Operations"}
              </span>
            </div>
            <div className="glass-pill flex shrink-0 items-center gap-1 rounded-full p-1 sm:gap-1.5">
              <LocationSwitcher active={activeLocation} options={scope.availableLocations} />
              <EventSwitcher events={events} activeEventId={activeEvent?.id ?? null} />
              <UserMenu
                name={session.user.name ?? "User"}
                email={session.user.email ?? ""}
                role={scope.role}
                locationName={activeLocation.name}
              />
            </div>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="relative z-10 flex-1 pb-tabbar outline-none lg:pb-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <HeaderHeightVar />
      <MobileTabBar role={scope.role} />
    </div>
  );
}
