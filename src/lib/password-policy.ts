/*
  The one number the server enforces and the forms promise, in a file with no
  server-only imports so a client component can state the rule without pulling
  bcrypt and Prisma into the browser bundle.

  Sign-in deliberately still accepts shorter passwords: this is the rule for
  choosing a new one, and applying it at the comparison would lock out anyone
  whose existing password predates it.
*/
export const MIN_PASSWORD_LENGTH = 8;
