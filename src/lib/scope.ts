import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { can, homeFor, type Capability } from "@/lib/permissions";

const LOCATION_COOKIE = "active-location";

export type Scope = {
  userId: string;
  businessId: string;
  role: Role;
  locationId: string;
  locationName: string;
  availableLocations: { id: string; name: string; kind: "STORE" | "EVENT" }[];
};

export async function getScope(): Promise<Scope> {
  const user = await requireUser();
  const cookieStore = await cookies();
  const requested = cookieStore.get(LOCATION_COOKIE)?.value;

  const memberships = await prisma.userLocation.findMany({
    where: { userId: user.id },
    include: { location: true },
    orderBy: { location: { name: "asc" } },
  });

  const available = memberships.map((m) => m.location);
  /*
    A real state, not a can't-happen: an account created before any location
    exists gets none, and deleting a location takes them away from whoever was
    only in that one. This used to throw from inside the app layout, where no
    error boundary in the segment can catch it — so the whole app was replaced
    by the bare global error page, which has no sign-out and whose "try again"
    just threw again. Unreachable and unrecoverable, from ordinary owner
    activity. Now it goes somewhere that explains itself and can sign out.
  */
  if (available.length === 0) redirect("/no-access");

  let active = available.find((l) => l.id === requested);
  if (!active) active = available[0];

  return {
    userId: user.id,
    businessId: user.businessId,
    role: user.role,
    locationId: active.id,
    locationName: active.name,
    availableLocations: available.map((l) => ({ id: l.id, name: l.name, kind: l.kind })),
  };
}

/*
  The gate for a page. Sends anyone without the capability to their own home
  rather than 404ing, so a staff member who follows a stale link lands
  somewhere they can actually use — and never at /dashboard, which for them
  would bounce straight back here.
*/
export async function requireCapability(capability: Capability): Promise<Scope> {
  const scope = await getScope();
  if (!can(scope.role, capability)) redirect(homeFor(scope.role));
  return scope;
}

/*
  The same gate for a route handler, which has to answer with a status rather
  than a redirect. Returns null when the role may not have this, so the caller
  replies 403.
*/
export async function scopeFor(capability: Capability): Promise<Scope | null> {
  const scope = await getScope();
  return can(scope.role, capability) ? scope : null;
}

export async function setActiveLocation(locationId: string) {
  const cookieStore = await cookies();
  cookieStore.set(LOCATION_COOKIE, locationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
}
