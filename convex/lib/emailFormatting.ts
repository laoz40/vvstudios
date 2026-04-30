import { env } from "../env";

export function getHostEmails() {
	return env.GOOGLE_CALENDAR_HOST_EMAILS.split(",")
		.map((email) => email.trim())
		.filter(Boolean);
}

export function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
