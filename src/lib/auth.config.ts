import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

// Edge-safe config used by middleware. Does NOT import bcrypt / Prisma.
// The full provider with `authorize` lives in `@/lib/auth`.
export const authConfig: NextAuthConfig = {
  // Sessions now last 1 year (until the user signs out themselves, or 1 year idle).
  session: { strategy: "jwt", maxAge: 365 * 24 * 60 * 60 },
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
