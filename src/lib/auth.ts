import { cache } from "react";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { can, type Capability } from "@/lib/permissions";
import { findOrCreateGoogleUser, verifiedEmail } from "@/modules/auth/google";
import { writeAudit } from "@/lib/audit";
import {
  checkSignupAllowed,
  recordSignupAttempt,
  signupKeys,
  checkLoginAllowed,
  clearLoginFailures,
  clientIpFrom,
  LoginLockedError,
  loginKeys,
  recordLoginFailure,
} from "@/modules/auth/rate-limit";

// A bcrypt hash of a value nobody can supply. Compared against when the address
// is unknown so an unknown address costs the same time as a wrong password —
// otherwise the response time reveals which addresses are registered.
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      businessId: string;
    } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/** Google sign-in is offered only when its keys are set, so nothing shows or breaks before then. */
export const googleEnabled = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    /*
      Google: verified email only, then find the user or make a business for
      them. Returning a path sends the browser there with the reason, which the
      login page turns into a sentence.
    */
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      const email = verifiedEmail(profile);
      if (!email) return "/login?error=GoogleUnverified";
      try {
        const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (!exists) {
          // Making a business is the same act as signing up, so it shares that throttle.
          const keys = signupKeys(clientIpFrom(await headers()));
          const limit = await checkSignupAllowed(keys);
          if (limit.locked) return "/login?error=GoogleRateLimited";
          await recordSignupAttempt(keys);
        }
        const tz = (await cookies()).get("gc_tz")?.value ?? null;
        const u = await findOrCreateGoogleUser(prisma, { email, name: profile?.name }, tz);
        if (u.created) {
          await writeAudit({
            businessId: u.businessId, userId: u.id,
            action: "business.signup", entityType: "Business", entityId: u.businessId,
            diff: { method: "google" },
          });
        }
        return true;
      } catch (e) {
        console.error("[auth] google sign-in failed:", e instanceof Error ? e.message : e);
        return "/login?error=GoogleFailed";
      }
    },
    async jwt(args) {
      const token = (await authConfig.callbacks!.jwt!(args)) ?? args.token;
      // First sign-in with Google: the id, role and business come from OUR user
      // row (matched by the verified email), never from anything Google sent.
      if (args.account?.provider === "google" && args.token.email) {
        const u = await prisma.user.findUnique({
          where: { email: String(args.token.email).toLowerCase() },
          select: { id: true, role: true, businessId: true },
        });
        if (u) { token.id = u.id; token.role = u.role; token.businessId = u.businessId; }
      }
      return token;
    },
  },
  providers: [
    ...(googleEnabled()
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
      : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.trim().toLowerCase();
        const ip = request ? clientIpFrom(new Headers(request.headers)) : null;
        const keys = loginKeys(email, ip);

        // Refuse before touching the password, and identically whether or not
        // the address exists.
        const state = await checkLoginAllowed(keys);
        if (state.locked) throw new LoginLockedError(state.retryAfterSec);

        const user = await prisma.user.findUnique({ where: { email } });
        // Always run a comparison so an unknown address is not measurably faster.
        const ok = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);

        if (!user || !ok) {
          await recordLoginFailure(keys, email);
          return null;
        }

        await clearLoginFailures(keys);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          businessId: user.businessId,
        } as unknown as { id: string };
      },
    }),
  ],
});

/*
  The signed-in user, read from the database rather than out of the token.

  The role travels in the JWT, and a JWT is only rewritten at sign-in — so an
  owner who demotes somebody, or deletes them outright, would otherwise not
  take effect until that person next happened to sign out. Every gate reads
  this instead, so a change lands on their very next request. cache() collapses
  it to one query per request however many gates consult it.

  Returns null rather than throwing so a deleted account is a clean signed-out
  state, not a crash.
*/
export const currentUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      businessId: true,
      mustChangePassword: true,
    },
  });
});

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "OWNER") throw new Error("FORBIDDEN");
  return user;
}

/*
  The gate every Server Action outside the owner-only ones should use. A
  Server Action is reachable by anyone who can shape the request, so the check
  inside it is the only real one — hiding a page or a nav item protects
  nothing.
*/
export async function requireCan(capability: Capability) {
  const user = await requireUser();
  if (!can(user.role, capability)) throw new Error("FORBIDDEN");
  return user;
}
