"use client";
import * as React from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleTile } from "@/components/toggle-tile";
import { toast } from "@/components/ui/use-toast";
import { setAiScanningAction } from "@/modules/admin/actions";

/*
  The one switch for AI. On: the Gmail scan sends invoice emails to Anthropic's
  API to read the supplier, date and totals. Off: no email is fetched or sent,
  scheduled scans skip this business and "Scan now" says it is off. Square sales
  sync is unaffected either way; it reads Square's own figures and uses no AI.
*/
export function AiScanningCard({ enabled }: { enabled: boolean }) {
  const [on, setOn] = React.useState(enabled);
  React.useEffect(() => setOn(enabled), [enabled]);
  const toggle = () => {
    const next = !on;
    setOn(next);
    void (async () => {
      const res = await setAiScanningAction(next);
      if (res && "error" in res) {
        setOn(!next);
        toast({ title: res.error, variant: "destructive" });
      } else {
        toast({ title: next ? "AI invoice reading is on" : "AI invoice reading is off" });
      }
    })();
  };
  return (
    <Card id="ai" data-settings-section>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden /> AI invoice reading
        </CardTitle>
        <CardDescription>Uses the Anthropic API to read supplier invoices from Gmail</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ToggleTile
          checked={on}
          onChange={toggle}
          title={on ? "On" : "Off"}
          detail={
            on
              ? "Invoice emails are sent to Anthropic to read the supplier, date and totals, every 3 hours and on Scan now."
              : "No email is read or sent anywhere. Scheduled scans skip this business and Scan now is paused."
          }
        />
        <p className="text-2xs leading-relaxed text-muted-foreground">
          Square sales sync is not affected: it copies Square&apos;s own figures and does not use AI.
          Invoices already logged stay as they are.
        </p>
      </CardContent>
    </Card>
  );
}
