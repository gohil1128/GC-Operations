/*
  Outbound email, or an honest answer that there is none.

  Deliberately a plain fetch against Resend's REST API rather than an SDK: it
  is one POST, and a dependency that only ever makes one call is a dependency
  to keep updated forever. Configure by setting RESEND_API_KEY and MAIL_FROM.

  Nothing in the app *depends* on this working. Every reset link can also be
  handed over directly by an owner, so an unconfigured mailer degrades to
  "copy this link to them" rather than to a dead end — which is why this
  returns a reason instead of throwing.
*/

export type MailResult = { sent: true } | { sent: false; reason: string };

export function mailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return { sent: false, reason: "No email service is configured." };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, text: opts.text }),
      // A sign-in page must not hang on someone else's outage.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, reason: `Email provider refused the message (${res.status}). ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "Could not reach the email provider." };
  }
}
