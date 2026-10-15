import { sendEmail } from "#convex/shared/lib/email/emailSend";
import { CONTACT_EMAIL } from "#/config/contact";
import { escapeHtml } from "#convex/shared/lib/email/emailSend";

export function sendFeedbackEmailForMessage(message: string) {
	return sendEmail({
		to: [CONTACT_EMAIL],
		subject: "New VV Studios feedback",
		logContext: { operation: "email.sendFeedback" },
		html: [
			"<p>You received new feedback from the VV Studios website.</p>",
			"<p><strong>Message:</strong></p>",
			`<p>${escapeHtml(message).replaceAll("\n", "<br />")}</p>`
		].join("")
	});
}
