"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Link as LinkIcon, Shield, Trash2 } from "lucide-react";
import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/permissions";

const ROLES: Role[] = ["OWNER", "MANAGER", "STAFF"];
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { CredentialsDialog } from "./credentials-dialog";
import { ResetLinkDialog } from "./reset-link-dialog";
import {
  resetPasswordAction,
  deleteUserAction,
  updateUserRoleAction,
  createResetLinkAction,
} from "@/modules/users/actions";
import { toast } from "@/components/ui/use-toast";

type Props = {
  userId: string;
  userName: string;
  userEmail: string;
  currentRole: Role;
  isSelf: boolean;
};

export function UserRowActions({ userId, userName, userEmail, currentRole, isSelf }: Props) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [credentials, setCredentials] = React.useState<{ email: string; password: string } | null>(null);
  const [resetLink, setResetLink] = React.useState<{ url: string; expiresAt: string; name: string } | null>(null);

  const makeLink = () => {
    start(async () => {
      const res = await createResetLinkAction(userId);
      if ("error" in res) {
        toast({ title: "Could not create a link", description: res.error, variant: "destructive" });
        return;
      }
      setResetLink({ url: res.url, expiresAt: res.expiresAt, name: res.name });
    });
  };

  const reset = () => {
    if (!confirm(`Reset password for ${userName}? They'll need the new password to log in.`)) return;
    start(async () => {
      const res = await resetPasswordAction(userId);
      if ("error" in res) {
        toast({ title: "Reset failed", description: res.error, variant: "destructive" });
        return;
      }
      setCredentials({ email: res.email, password: res.password });
      router.refresh();
    });
  };

  const remove = () => {
    if (!confirm(`Delete ${userName} (${userEmail})? This can't be undone.`)) return;
    start(async () => {
      const res = await deleteUserAction(userId);
      if ("error" in res) {
        toast({ title: "Delete failed", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "User deleted" });
      router.refresh();
    });
  };

  const changeRole = (next: Role) => {
    if (next === currentRole) return;
    start(async () => {
      const res = await updateUserRoleAction(userId, next);
      if ("error" in res) {
        toast({ title: "Failed", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: `Role changed to ${next.toLowerCase()}` });
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending} className="h-7 px-2 text-xs">Manage</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={reset}>
            <KeyRound className="h-3.5 w-3.5" /> Reset password
          </DropdownMenuItem>
          <DropdownMenuItem onClick={makeLink}>
            <LinkIcon className="h-3.5 w-3.5" /> Get a reset link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* Every role except the one they already have, so there is no
              "promote/demote" wording to get backwards with three of them. */}
          {ROLES.filter((r) => r !== currentRole).map((r) => (
            <DropdownMenuItem key={r} onClick={() => changeRole(r)} disabled={isSelf}>
              <Shield className="h-3.5 w-3.5" /> Make {ROLE_LABELS[r]}
            </DropdownMenuItem>
          ))}
          {!isSelf && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={remove} className="text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Delete user
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {credentials && (
        <CredentialsDialog
          title="Password reset — share the new password"
          email={credentials.email}
          password={credentials.password}
          onClose={() => setCredentials(null)}
        />
      )}

      {resetLink && (
        <ResetLinkDialog
          name={resetLink.name}
          url={resetLink.url}
          expiresAt={resetLink.expiresAt}
          onClose={() => setResetLink(null)}
        />
      )}
    </>
  );
}
