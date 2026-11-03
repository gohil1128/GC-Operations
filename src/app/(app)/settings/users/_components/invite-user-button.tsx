"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CredentialsDialog } from "./credentials-dialog";
import { inviteUserAction } from "@/modules/users/actions";
import { toast } from "@/components/ui/use-toast";

export function InviteUserButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const [credentials, setCredentials] = React.useState<{ email: string; password: string } | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await inviteUserAction(fd);
      if ("error" in res) {
        toast({ title: "Could not invite", description: res.error, variant: "destructive" });
        return;
      }
      setCredentials({ email: res.email, password: res.password });
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm"><UserPlus className="h-3.5 w-3.5" /> Add user</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a new user</DialogTitle>
            <DialogDescription>
              Creates an account they can sign in with. You&apos;ll get a temporary password to pass
              on — they have to choose their own before the app will let them in, so it only ever
              works once.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="iu-name">Name</Label>
              <Input id="iu-name" name="name" required placeholder="e.g. Harshraj Gohil" autoFocus />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="iu-email">Email</Label>
              <Input id="iu-email" name="email" type="email" required placeholder="cofounder@example.com" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="iu-role">Role</Label>
              {/* Staff is the default: it is the role most people added to a
                  team should have, and the one whose mistake is cheapest. */}
              <Select name="role" defaultValue="STAFF">
                <SelectTrigger id="iu-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Staff — cash closes and inventory counts only</SelectItem>
                  <SelectItem value="MANAGER">Manager — everything day to day, no settings</SelectItem>
                  <SelectItem value="OWNER">Owner — full access, including the team</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-2xs text-muted-foreground">
                Staff see no sales, costs, invoices or reports.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Creating..." : "Create account"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {credentials && (
        <CredentialsDialog
          title="Account created — share these credentials"
          email={credentials.email}
          password={credentials.password}
          onClose={() => setCredentials(null)}
        />
      )}
    </>
  );
}
