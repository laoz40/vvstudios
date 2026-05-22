import { serverEnv } from "#/env.server";

export async function sendFeedbackEmail({
  html,
  to,
}: {
  html: string;
  to: string;
}) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${serverEnv.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `VV Studios <${serverEnv.RESEND_FROM_EMAIL}>`,
      to: [to],
      subject: "New VV Studios website feedback",
      html,
    }),
  });
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
