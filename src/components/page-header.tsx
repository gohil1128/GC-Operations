import { cn } from "@/lib/utils";

// Page masthead: small breadcrumb eyebrow over a large display title, with
// pill actions on the right. No divider — the cream canvas separates it from
// the bento cards below.
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
    /*
      The photograph belongs to the masthead, not the page.

      It used to be a fixed 288px band on the scrolling column, which meant
      whatever a page put immediately under its title — a stat tile, a toolbar
      — landed on the photo in whatever colour it was written for, and was
      unreadable. Sized to this block instead, the band always ends where the
      masthead ends and everything below it is on cream, whatever the page.
    */
    <div className="relative" data-on-photo>
      <div className="app-photo" aria-hidden />
      <div
        className={cn(
          "relative mx-auto flex max-w-[1400px] flex-col gap-3 px-4 pb-5 pt-5 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:px-6 sm:pt-6 lg:px-8",
          className,
        )}
      >
      {/*
        The masthead sits inside the photograph band, so its type is light in
        both themes — the scrim behind it is ink either way. Display type at
        this size clears 3:1 over the scrim; the eyebrow and description are
        held at .78–.85 rather than pure white so they stay secondary without
        dropping under 4.5:1.
      */}
      <div>
        {/* /80, not /78: Tailwind's opacity scale steps in fives, so a value
            off the scale generates no rule at all and the text silently falls
            back to the inherited dark ink — invisible on the photograph. */}
        {eyebrow && <div className="text-xs text-white/80">{eyebrow}</div>}
        <h1 /* font-normal, not font-light. The display face is loaded at 400-700, so
            a 300 request was already falling back to 400 and the class said
            something the page did not do. Apple is also explicit that Ultralight,
            Thin and Light have no place in this language. */
        className="display-num mt-1 text-[26px] font-medium text-white sm:text-[40px] sm:font-normal sm:tracking-[-0.025em]">
          {title}
        </h1>
        {description && <p className="mt-1.5 text-sm text-white/85">{description}</p>}
      </div>
        {/* Actions sit on the photograph, so they get the frosted pill the
            toolbar uses — dark button labels straight on the photo were the
            other half of this problem. */}
        {actions && (
          /* Navigation and export controls, not content — gone from the
             printed sheet, including whichever button started the print. */
          <div
            data-print="hide"
            className="glass-pill flex flex-wrap items-center gap-2 self-start rounded-full p-1 sm:self-auto"
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
