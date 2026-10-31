import { cn } from "@/lib/utils";

/*
  A page's controls, kept reachable.

  Sits directly under the app header and stays there while the page scrolls,
  so the period control and the CSV button are still in reach at the bottom of
  a long list instead of needing a scroll back to the top.

  `top` reads the variable HeaderHeightVar measures, with the desktop height as
  a fallback for the first paint before the effect runs. z-30 keeps it below
  the app header's z-40, so the two never fight over the same pixels.
*/
export function StickyToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-print="hide"
      className={cn("sticky z-30 border-b border-border/70 glass", className)}
      style={{ top: "var(--app-header-h, 57px)" }}
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-4 py-2 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
