import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    /*
    lg-press replaces what was `transition-all duration-150 active:scale-[0.98]`.
    Two differences that matter. The curve is a solved spring rather than the
    browser's default ease, so the release carries momentum and settles instead
    of stopping dead. And it transitions named properties rather than `all` —
    `all` meant every paint-affecting change on a button, including width when
    its label changed, animated for 150ms whether or not that was wanted.
  */
  /*
    One shape for every button. The icon rule means a glyph is the same size
    wherever it sits (16px, or 14px in the small size) without each caller
    remembering to say so, and a label next to it is always 8px away.
  */
  "lg-press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 [&_svg:not([class*='h-'])]:h-4 [&_svg:not([class*='w-'])]:w-4",
  {
    variants: {
      variant: {
        // Lime with olive ink: the one loud button on a screen. Brightness, not
        // opacity, on hover: lime at 90% over a card goes muddy.
        default: "bg-highlight text-highlight-foreground hover:brightness-95",
        destructive: "bg-destructive text-destructive-foreground hover:brightness-95",
        // The everyday button: a hairline and the card colour, quiet until pointed at.
        outline: "border border-border bg-card text-foreground hover:bg-muted",
        // A filled but calm button, for a secondary action next to a primary one.
        secondary: "bg-muted text-foreground hover:bg-muted/70",
        // Tinted, for "good thing, optional": Re-open, Tag them, Open.
        soft: "bg-brand-muted text-brand-ink hover:brightness-95",
        // Tinted red, for "risky, but not the point of this screen": a delete in a row.
        danger: "bg-destructive-muted text-destructive hover:brightness-95",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "text-brand-ink underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground hover:brightness-95",
        brand: "bg-brand-strong text-brand-foreground hover:brightness-95",
      },
      size: {
        // Heights are 40/36/48 rather than 36/32/44: a thumb needs the room, and
        // the small size is used 95 times, mostly on a phone.
        default: "h-10 px-4",
        sm: "h-9 px-3.5 text-[13px] [&_svg:not([class*='h-'])]:h-3.5 [&_svg:not([class*='w-'])]:w-3.5",
        lg: "h-12 px-6 text-[0.95rem]",
        icon: "h-10 w-10",
        "icon-sm": "h-9 w-9 [&_svg:not([class*='h-'])]:h-3.5 [&_svg:not([class*='w-'])]:w-3.5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    /*
      data-ui="button" so the print stylesheet can drop controls from a
      printed sheet. Element selectors are not enough: asChild renders a
      Link, so half the buttons in this app are anchors carrying button
      classes and nothing else to recognise them by. A caller that wants to
      keep one — the button that starts the print — passes data-print="keep",
      which the spread below lets through.
    */
    return (
      <Comp
        data-ui="button"
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
