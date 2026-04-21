// functions/api/contact.ts
// POST /api/contact  →  verifies Turnstile token, sends email via MailChannels
//
// Required env (set as secrets):
//   TURNSTILE_SECRET  — server-side Turnstile secret
//   CONTACT_TO        — address to receive mail (e.g., hello@xconsultingwork.com)
//   CONTACT_FROM      — verified sending address (DKIM on your domain)

interface Env {
  TURNSTILE_SECRET: string;
  CONTACT_TO: string;
  CONTACT_FROM: string;
}

const MAX_NAME = 100;
const MAX_EMAIL = 200;
const MAX_MESSAGE = 4000;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { name?: string; email?: string; message?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const name = (body.name ?? "").toString().trim().slice(0, MAX_NAME);
  const email = (body.email ?? "").toString().trim().slice(0, MAX_EMAIL);
  const message = (body.message ?? "").toString().trim().slice(0, MAX_MESSAGE);
  const token = (body.token ?? "").toString();

  if (!name || !email || !message) {
    return Response.json({ error: "all fields required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "invalid email" }, { status: 400 });
  }
  if (!token) {
    return Response.json({ error: "missing captcha token" }, { status: 400 });
  }

  // ——— verify Turnstile ———
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  const verify = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: ip,
      }),
    }
  );
  const verifyData = await verify.json() as { success: boolean; "error-codes"?: string[] };
  if (!verifyData.success) {
    return Response.json(
      { error: "captcha verification failed", codes: verifyData["error-codes"] },
      { status: 400 }
    );
  }

  // ——— send via MailChannels ———
  // MailChannels is free for Cloudflare Workers. DKIM must be set on the sending domain.
  const mailRes = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: env.CONTACT_TO, name: "Contact" }] }],
      from: { email: env.CONTACT_FROM, name: "cf-examples contact form" },
      reply_to: { email, name },
      subject: `Contact form: ${name}`,
      content: [
        {
          type: "text/plain",
          value:
            `From: ${name} <${email}>\n` +
            `IP: ${ip}\n` +
            `Country: ${request.cf?.country ?? "??"}\n\n` +
            `---\n\n${message}\n`,
        },
      ],
    }),
  });

  if (!mailRes.ok) {
    const detail = await mailRes.text();
    return Response.json(
      { error: "send failed", detail: detail.slice(0, 500) },
      { status: 502 }
    );
  }

  return Response.json({ ok: true });
};
