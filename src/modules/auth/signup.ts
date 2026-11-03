"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LocationKind, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/lib/auth";
import { setActiveLocation } from "@/lib/scope";
import { writeAudit } from "@/lib/audit";
import { hashPassword, passwordSchema } from "@/modules/auth/password";
import {
  checkSignupAllowed,
  clientIpFrom,
  recordSignupAttempt,
  signupKeys,
} from "@/modules/auth/rate-limit";

/*
  Self-serve signup: the thing that decides whether a second customer can exist.

  Until now a business could only be created by hand-written SQL against the
  production database, so "sell this to other people" was blocked on something
  no amount of polish would fix.

  No payment. The product is free for now by decision, so there is no plan, no
  subscription and no card — and deliberately no dormant billing code sitting
  around pretending otherwise.

  One transaction creates the whole tenant: a Business, its first Location, an
  OWNER, and that owner's membership of the location. All four or none. A
  half-made tenant is worse than none: getScope() sends a user with no location
  to /no-access, which would strand somebody who had just signed up and could
  not be fixed from inside the app.
*/

const IANA_ZONE = z.string().refine(
  (tz) => {
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  { message: "Not a recognised timezone" },
);

const signupSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name").max(120),
  businessName: z.string().trim().min(1, "Name your business").max(120),
  email: z.string().trim().toLowerCase().email("That does not look like an email address"),
  password: passwordSchema,
  // Sent from the browser's own Intl guess, validated here. Every business day
  // in the app comes from this, so a wrong one files evening takings under
  // tomorrow — the bug that cost this product a day earlier.
  timezone: IANA_ZONE,
});

export type SignupState = { error?: string; field?: string } | null;

export async function signUpAction(_prev: unknown, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check the form", field: String(issue?.path?.[0] ?? "") };
  }
  const { name, businessName, email, password, timezone } = parsed.data;

  const keys = signupKeys(clientIpFrom(await headers()));
  const limit = await checkSignupAllowed(keys);
  if (limit.locked) {
    return { error: "Too many accounts created from here. Try again in an hour." };
  }
  // Counted before the work, so a run of failures throttles just as a run of
  // successes does.
  await recordSignupAttempt(keys);

  /*
    User.email is globally unique, so one address belongs to one business. That
    is a real limit — a person who runs two stalls, or an accountant working
    across several, needs two addresses — but it is the schema as it stands and
    changing it is a migration, not a signup form. Said plainly rather than
    failing with a unique-constraint stack trace.
  */
  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) {
    return {
      error: "An account already uses that email. Sign in instead, or use another address.",
      field: "email",
    };
  }

  const passwordHash = await hashPassword(password);

  let locationId = "";
  let businessId = "";
  let userId = "";
  try {
    await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { name: businessName, timezone },
      });
      const location = await tx.location.create({
        data: {
          businessId: business.id,
          name: businessName,
          // EVENT rather than STORE: this product is for businesses that trade
          // at markets and festivals. A fixed store is the unusual case, and
          // the name is editable in settings either way.
          kind: LocationKind.EVENT,
        },
      });
      const user = await tx.user.create({
        data: {
          businessId: business.id,
          email,
          name,
          role: Role.OWNER,
          passwordHash,
          // They chose it themselves, so there is nothing to force a change of.
          mustChangePassword: false,
        },
      });
      await tx.userLocation.create({ data: { userId: user.id, locationId: location.id } });

      businessId = business.id;
      locationId = location.id;
      userId = user.id;
    });
  } catch {
    // A race on the unique email is the realistic case; anything else is a
    // database problem the customer can do nothing about either way.
    return { error: "Could not create the account. Please try again.", field: "email" };
  }

  await writeAudit({
    businessId,
    userId,
    action: "business.signup",
    entityType: "Business",
    entityId: businessId,
    diff: { businessName, timezone },
  });

  // Signed in directly: bouncing someone to a login form to retype the
  // password they just chose is a step with nothing in it.
  await signIn("credentials", { email, password, redirect: false });
  await setActiveLocation(locationId);

  redirect("/dashboard?welcome=1");
}
