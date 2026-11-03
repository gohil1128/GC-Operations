"use client";
import * as React from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

/*
  Turn on "tell me when someone asks to join" for this phone or computer.

  It needs three things from the browser, and says which one is missing rather
  than failing quietly: notifications at all; on iPhone, the app added to the
  home screen first (Apple only allows notifications from an installed web app,
  iOS 16.4 and later); and the person's permission.
*/

function keyBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "checking" | "unsupported" | "needs-install" | "denied" | "off" | "on";

export function JoinAlerts({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = React.useState<State>("checking");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(ios && !standalone ? "needs-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  if (!publicKey) {
    return (
      <p className="mb-4 rounded-2xl border border-border-soft bg-card px-4 py-3 text-xs text-muted-foreground">
        Join notifications aren&apos;t set up yet: <span className="font-mono">VAPID_PUBLIC_KEY</span> and{" "}
        <span className="font-mono">VAPID_PRIVATE_KEY</span> need adding in Vercel (see docs/PUSH-NOTIFICATIONS.md).
      </p>
    );
  }

  const turnOn = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as unknown as BufferSource });
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error("The server didn't accept it.");
      setState("on");
      toast({ title: "You'll be told when someone asks to join" });
    } catch (e) {
      toast({ title: "Couldn't turn on notifications", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
      toast({ title: "Notifications off on this device" });
    } finally {
      setBusy(false);
    }
  };

  if (state === "checking") return null;
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-soft bg-card px-4 py-3">
      <div className="min-w-0 text-sm">
        <p className="font-medium">Tell me when someone asks to join</p>
        <p className="text-xs text-muted-foreground">
          {state === "on" && "On for this device. You can approve or decline right from the notification."}
          {state === "off" && "A notification with Approve and Decline buttons, on this device."}
          {state === "denied" && "Notifications are blocked for this site. Allow them in your browser or phone settings, then come back."}
          {state === "needs-install" && "On iPhone, add this app to your home screen first (Share → Add to Home Screen), then open it from there and turn this on."}
          {state === "unsupported" && "This browser can't show notifications."}
        </p>
      </div>
      {state === "off" && <Button size="sm" onClick={turnOn} disabled={busy}><Bell /> Turn on</Button>}
      {state === "on" && <Button size="sm" variant="outline" onClick={turnOff} disabled={busy}><BellOff /> Turn off</Button>}
    </div>
  );
}
