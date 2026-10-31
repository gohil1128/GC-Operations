import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCapability } from "@/lib/scope";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { TableOnDesktop, MobileList, MobileRow, MobileField, MobileEmpty } from "@/components/mobile-list";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/date";
import { ROLE_LABELS } from "@/lib/permissions";
import { InviteUserButton } from "./_components/invite-user-button";
import { UserRowActions } from "./_components/user-row-actions";

export const dynamic = "force-dynamic";

// Most privileged reads loudest; staff sit quietly, which is also how often
// you need to think about them.
const ROLE_BADGE = {
  OWNER: "default",
  MANAGER: "secondary",
  STAFF: "muted",
} as const;

export default async function UsersPage() {
  const scope = await requireCapability("settings");

  const users = await prisma.user.findMany({
    where: { businessId: scope.businessId },
    include: { locations: { include: { location: { select: { name: true } } } } },
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <PageHeader
        eyebrow="Settings · Team"
        title="Users"
        description={`${users.length} user${users.length === 1 ? "" : "s"} in this business`}
        actions={
          <>
            <Button asChild variant="outline" size="sm"><Link href="/settings"><ArrowLeft className="h-3.5 w-3.5" /> Settings</Link></Button>
            <InviteUserButton />
          </>
        }
      />
      <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <div className="bento">
          <TableOnDesktop>
              <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Locations</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <Link href={`/settings/users/${u.id}`} className="hover:underline">
                      {u.name}
                    </Link>
                    {u.id === scope.userId && <Badge variant="muted" className="ml-2 text-2xs">You</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={ROLE_BADGE[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                    {u.mustChangePassword && (
                      <Badge variant="muted" className="ml-1.5 text-2xs">Temp password</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.locations.map((l) => l.location.name).join(", ") || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(u.createdAt)}</TableCell>
                  <TableCell>
                    <UserRowActions
                      userId={u.id}
                      userName={u.name}
                      userEmail={u.email}
                      currentRole={u.role}
                      isSelf={u.id === scope.userId}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
            </TableOnDesktop>

            <MobileList>
              {users.map((u) => (
                <MobileRow
                  key={u.id}
                  title={
                    <Link href={`/settings/users/${u.id}`} className="hover:underline">
                      {u.name}
                    </Link>
                  }
                  subtitle={u.email}
                  badges={
                    <>
                      <Badge variant={ROLE_BADGE[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                      {u.mustChangePassword && <Badge variant="muted">Temp password</Badge>}
                      {u.id === scope.userId && <Badge variant="muted">You</Badge>}
                      <span className="ml-auto">
                        <UserRowActions
                          userId={u.id}
                          userName={u.name}
                          userEmail={u.email}
                          currentRole={u.role}
                          isSelf={u.id === scope.userId}
                        />
                      </span>
                    </>
                  }
                >
                  <MobileField label="Locations" value={u.locations.map((l) => l.location.name).join(", ") || "—"} />
                  <MobileField label="Added" value={fmtDate(u.createdAt)} />
                </MobileRow>
              ))}
              {users.length === 0 && <MobileEmpty>No team members yet.</MobileEmpty>}
            </MobileList>
        </div>
      </div>
    </div>
  );
}
