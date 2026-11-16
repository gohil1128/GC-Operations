import { cn } from "@/lib/utils";

/*
  Page masthead: a small eyebrow over a display title, a line of description,
  and actions on the right, closed by a hairline.

  THE PHOTOGRAPH IS GONE. Every page used to open with a band of the hero shot
  under a scrim, with the title reversed out in white — which cost roughly a
  fifth of a tablet screen before the first figure, needed its own contrast
  rules because the type sat on an image, and forced the actions into a
  frosted pill so their labels would not disappear into it.

  v3 puts the content first on a flat page. The type is dark on cream, so it
  reads under the same rules as everything else, and the actions are ordinary
  controls again. This is the same header the Overview builds inline — the two
  are kept in step deliberately, since the Overview is the page people judge
  the rest against.
*/
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: {
  title: string;
  eyebrow?: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        /* v3 quotes the content padding as 22px 30px, but that is measured off a
           fixed 1280px mock with no container. This app centres every page in a
           max-w-[1400px] column with px-4/6/8, and 35 route files already do it,
           so the header follows that instead — a header indented differently
           from the figures under it is worse than a few px off a mock. */
        "mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:flex-nowrap px-4 pb-1 pt-2 sm:gap-5 sm:px-6 sm:pb-5 sm:pt-5 lg:px-8",
        className,
      )}
    >
      <div className="min-w-[60%] flex-1 sm:min-w-0 sm:flex-none">
        {eyebrow && <div className="hidden text-xs text-muted-foreground sm:block">{eyebrow}</div>}
        <h1
          /* font-semibold at 26px, which is v3's display setting. Not lighter:
             the face is loaded at 400-700 and Apple's own guidance rules out
             Thin and Light for anything structural. */
          className="font-display text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]"
        >
          {title}
        </h1>
        {description && <p className="mt-[3px] hidden text-[13px] text-muted-foreground sm:block">{description}</p>}
      </div>
      {actions && (
        /* Navigation and export controls, not content — gone from the printed
           sheet, including whichever button started the print. */
        <div data-print="hide" className="flex max-w-full flex-wrap items-center gap-1 max-sm:-ml-1 sm:shrink-0 sm:gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
