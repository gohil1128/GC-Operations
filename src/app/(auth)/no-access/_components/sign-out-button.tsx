"use client";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/modules/auth/actions";

// The whole point of this page: the app shell (and with it the only other
// sign-out control) cannot render for an account in this state.
export function SignOutButton() {
  return (
    <Button
      size="lg"
      className="w-full"
      onClick={() => {
        navigator.serviceWorker?.controller?.postMessage("clear-cache");
        signOutAction();
      }}
    >
      <LogOut className="h-4 w-4" /> Sign out
    </Button>
  );
}
