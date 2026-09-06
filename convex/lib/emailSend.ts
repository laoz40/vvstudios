import { err, ok, ResultAsync } from "neverthrow";
import type { BookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import { formatEditingAddonLabel } from "#studio/features/booking-form/lib/editing-addon-quantities";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/bookingAddonQuantities";
import { env } from "#convex/env";

export interface EmailAttachment {
	content: Uint8Array;
	contentType: string;
	filename: string;
}

export function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

export function formatTimestampDateLong(timestamp: number) {
	return new Intl.DateTimeFormat("en-AU", {
		day: "numeric",
		month: "long",
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
		weekday: "long",
		year: "numeric"
	}).format(new Date(timestamp));
}

export function formatTimestampDateShort(timestamp: number) {
	return new Intl.DateTimeFormat("en-AU", {
		day: "numeric",
		month: "long",
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
		year: "numeric"
	}).format(new Date(timestamp));
}

export function formatAddonsLine(args: { addons: string[] } & BookingAddonQuantitiesArgs) {
	if (args.addons.length === 0) {
		return "None";
	}

	return args.addons
		.map((addon) => formatEditingAddonLabel(addon, args as BookingAddonQuantities))
		.join(", ");
}

export function getHostEmails() {
	return env.GOOGLE_CALENDAR_HOST_EMAILS.split(",")
		.map((email) => email.trim())
		.filter(Boolean);
}

export function sendEmail(args: {
	to: string[];
	subject: string;
	html: string;
	attachments?: EmailAttachment[];
	idempotencyKey?: string;
}) {
	const attachments = args.attachments?.map((attachment) => ({
		filename: attachment.filename,
		content: Buffer.from(attachment.content).toString("base64"),
		contentType: attachment.contentType
	}));

	return ResultAsync.fromPromise(
		fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.RESEND_API_KEY}`,
				"Content-Type": "application/json",
				...(args.idempotencyKey ? { "Idempotency-Key": args.idempotencyKey } : {})
			},
			body: JSON.stringify({
				from: `VV Studios <${env.RESEND_FROM_EMAIL}>`,
				to: args.to,
				subject: args.subject,
				html: args.html,
				...(attachments ? { attachments } : {})
			})
		}),
		() => ({ reason: "EMAIL_REQUEST_FAILED" as const })
	).andThen((response) => {
		if (response.ok) {
			return ok(null);
		}

		return ResultAsync.fromSafePromise(response.text()).andThen((body) => {
			console.error("Resend email response failed", {
				status: response.status,
				body,
				to: args.to,
				subject: args.subject,
				attachmentFilenames: attachments?.map((attachment) => attachment.filename) ?? []
			});
			return err({ reason: "EMAIL_RESPONSE_FAILED" as const });
		});
	});
}
