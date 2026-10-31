"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { LiquidIndicator } from "@/components/liquid-indicator";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "relative inline-flex h-9 items-center justify-center rounded-full bg-muted p-1 text-muted-foreground",
      className,
    )}
    {...props}
  >
    {/*
      One pill that slides between the tabs, rather than each tab turning its
      own background on. Radix keeps the selected value to itself, so the
      indicator watches for the data-state attribute instead of being told.

      A capsule inside a capsule under even padding is concentric for free —
      which is why the list is a capsule and the pill is too.
    */}
    <LiquidIndicator activeSelector='[data-state="active"]' axis="x" />
    {children}
  </TabsPrimitive.List>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // The active tab carried BOTH text-espresso-foreground and text-foreground.
      // The second won, so cream-on-espresso became ink-on-espresso — 1.23:1,
      // i.e. the selected tab's own label was unreadable.
      //
      // No background of its own any more: the travelling pill behind it is
      // the background. relative + z-10 keeps the label above it, and the
      // colour still switches here because that is per-tab, not per-pill.
      "lg-press relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:text-espresso-foreground",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-2 focus-visible:outline-none", className)} {...props} />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
