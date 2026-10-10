import { CONTACT_EMAIL } from "#/config/contact";
import { escapeHtml, sendEmail } from "#convex/lib/email/emailSend";

export function sendFeedbackEmailForMessage(message: string) {
	return sendEmail({
		to: [CONTACT_EMAIL],
		subject: "New VV Studios feedback",
		html: [
			"<p>You received new feedback from the VV Studios website.</p>",
			"<p><strong>Message:</strong></p>",
			`<p>${escapeHtml(message).replaceAll("\n", "<br />")}</p>`
		].join("")
	});
}
