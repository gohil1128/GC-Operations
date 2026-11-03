"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setActiveLocation } from "@/lib/scope";
import { homeFor } from "@/lib/permissions";
import { sendMail } from "@/lib/mailer";
import { createResetToken, consumeResetToken, passwordSchema } from "@/modules/auth/password";
import {
  checkLoginAllowed,
  clientIpFrom,
  loginKeys,
  recordLoginFailure,
} from "@/modules/auth/rate-limit";
import { headers } from "next/headers";
import { APP_NAME } from "@/lib/brand";

function waitText(sec: number): string {
  const mins = Math.ceil(sec / 60);
  return mins <= 1 ? "a minute" : `${mins} minutes`;
}

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password too short"),
});

export async function loginAction(_prev: unknown, formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  // Read the lock here too, so the form can say how long to wait instead of
  // repeating "invalid password" at someone who is already locked out.
  const ip = clientIpFrom(await headers());
  const keys = loginKeys(parsed.data.email, ip);
  const pre = await checkLoginAllowed(keys);
  if (pre.locked) {
    return { error: `Too many attempts. Try again in ${waitText(pre.retryAfterSec)}.` };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (err) {
    // authorize() throws LoginLockedError when this attempt trips the limit.
    if (err instanceof Error && /LOGIN_LOCKED/.test(err.message)) {
      const now = await checkLoginAllowed(keys);
      const wait = now.locked ? waitText(now.retryAfterSec) : "a few minutes";
      return { error: `Too many attempts. Try again in ${wait}.` };
    }
    const after = await checkLoginAllowed(keys);
    if (after.locked) {
      return { error: `Too many attempts. Try again in ${waitText(after.retryAfterSec)}.` };
    }
    return { error: "Invalid email or password." };
  }

  /*
    Where to land. Read straight from the row rather than from the session:
    the cookie signIn just set is not visible to auth() within this same
    request. Staff cannot open /dashboard, so sending everyone there would
    bounce them straight back to a page they are not allowed to see.
  */
  const account = await prisma.user.findUnique({
    where: { email: parsed.data.email.trim().toLowerCase() },
    select: { role: true, mustChangePassword: true },
  });
  redirect(
    account?.mustChangePassword ? "/change-password" : homeFor(account?.role ?? "MANAGER"),
  );
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function switchLocationAction(locationId: string) {
  if (!locationId) return;
  await setActiveLocation(locationId);
}

/*
  The answer is identical whether or not the address has an account — the whole
  point of a reset form is that it must not become a way to discover who banks
  here. So: no "unknown email" branch, no faster path for a miss, and the
  counter is bumped either way.

  The bucket is `reset:` rather than `email:`, deliberately. Sharing the login
  bucket would let anyone lock a colleague out of signing in just by spamming
  this form on their behalf.
*/
const RESET_ACKNOWLEDGEMENT =
  "If that address has an account, a reset link is on its way. Links last one hour. " +
  "If it does not arrive, ask an owner to reset your password from Settings → Team.";

export async function requestPasswordResetAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) {
    return { error: "Enter a valid email." };
  }

  const ip = clientIpFrom(await headers());
  const keys = [`reset:${email}`, ...(ip ? [`ip:${ip}`] : [])];
  const state = await checkLoginAllowed(keys);
  if (state.locked) {
    const mins = Math.ceil(state.retryAfterSec / 60);
    return { error: `Too many reset requests. Try again in ${mins <= 1 ? "a minute" : `${mins} minutes`}.` };
  }
  await recordLoginFailure(keys, email);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (user) {
    const { token } = await createResetToken(user.id);
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("host");
    const link = `${proto}://${host}/reset-password?token=${token}`;

    const result = await sendMail({
      to: email,
      subject: `Reset your ${APP_NAME} password`,
      text: `Hi ${user.name},\n\nOpen this link to choose a new password. It works once and expires in an hour.\n\n${link}\n\nIf you did not ask for this, you can ignore it — your current password still works.`,
    });
    // Never surfaced: telling this form that delivery failed would tell it the
    // address exists. The owner's in-app reset is the way through regardless.
    if (!result.sent) console.error("[password-reset] could not send:", result.reason);
  }

  return { ok: true, message: RESET_ACKNOWLEDGEMENT };
}

/** Spends a reset link and sets the new password. */
export async function resetPasswordWithTokenAction(_prev: unknown, formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const parsed = passwordSchema.safeParse(String(formData.get("newPassword") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the password" };
  if (String(formData.get("confirmPassword") ?? "") !== parsed.data) {
    return { error: "The two passwords do not match" };
  }

  const ok = await consumeResetToken(token, parsed.data);
  if (!ok) {
    return { error: "That link has expired or already been used. Request a new one." };
  }
  return { ok: true };
}
