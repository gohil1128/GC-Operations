import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Edge-safe config used by middleware. Does NOT import bcrypt / Prisma.
// The full provider with `authorize` lives in `@/lib/auth`.
export const authConfig: NextAuthConfig = {
  // Stated rather than inherited. This is the length sessions already ran to —
  // @auth/core's default — but it was never written down anywhere, while the
  // sign-in form offered a "Keep me signed in on this device" checkbox that
  // was stripped from the payload before it reached signIn() and changed
  // nothing either way. The checkbox is gone; the number lives here now, where
  // it can actually be changed.
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  trustHost: true,
  providers: [], // populated in @/lib/auth
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as { id: string; role: Role; businessId: string };
        token.id = u.id;
        token.role = u.role;
        token.businessId = u.businessId;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.businessId = token.businessId as string;
      }
      return session;
    },
  },
};
