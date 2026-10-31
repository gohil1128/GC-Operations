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
  "lg-press inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-espresso text-espresso-foreground hover:bg-espresso/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-border bg-card hover:bg-accent hover:text-accent-foreground hover:border-foreground/15",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-brand-ink underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground hover:bg-success/90",
        brand: "bg-brand-strong text-brand-foreground hover:bg-brand-strong/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-full px-3.5 text-xs",
        lg: "h-11 rounded-full px-6 text-[0.95rem]",
        icon: "h-9 w-9 rounded-full",
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
