"use client";
import * as React from "react";
import Link from "next/link";
import { KeyRound, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/permissions";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/modules/auth/actions";

export function UserMenu({
  name,
  email,
  role,
  locationName,
  trigger,
  align = "end",
}: {
  name: string;
  email: string;
  role: Role;
  /** Shown here because the header no longer prints it when there is only one. */
  locationName?: string;
  /*
    An alternative thing to click. The sidebar's user card is the menu in the
    v3 layout, and without this the card would either be dead decoration with
    sign-out hidden somewhere else, or a second copy of this menu's contents
    that could drift from it.
  */
  trigger?: React.ReactNode;
  align?: "start" | "end";
}) {
  const { theme, setTheme } = useTheme();
  // next-themes only knows the resolved theme after mount; rendering the icon
  // before that would mismatch the server HTML.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const dark = theme === "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" aria-label={`Account menu, ${name}`} className="gap-2 hdr-glass max-lg:h-11 max-sm:w-11 max-sm:px-0 data-[state=open]:bg-accent">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold max-sm:h-7 max-sm:w-7 max-sm:text-sm">
              {name.slice(0, 1).toUpperCase()}
            </div>
            <span className="hidden sm:inline">{name}</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{name}</span>
            <span className="text-2xs text-muted-foreground">{email}</span>
            <span className="mt-1 text-2xs uppercase text-muted-foreground">
              {ROLE_LABELS[role]}
              {locationName ? ` · ${locationName}` : ""}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/change-password">
            <KeyRound className="h-3.5 w-3.5" /> Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(e) => {
            // Keep the menu open so the change can be seen as it happens.
            e.preventDefault();
            setTheme(dark ? "light" : "dark");
          }}
        >
          {mounted && dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {mounted && dark ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            // Purge the service-worker cache on sign-out so nothing from this
            // session can be served to whoever signs in next.
            navigator.serviceWorker?.controller?.postMessage("clear-cache");
            signOutAction();
          }}
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
