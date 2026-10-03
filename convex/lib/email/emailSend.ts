import { err, ok } from "neverthrow";
import { tryPromise } from "#convex/lib/result";
import { formatEditingAddonLabel } from "#studio/features/booking-form/lib/editing-addon-quantities";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
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
		.map((addon) => formatEditingAddonLabel(addon, pickBookingAddonQuantities(args)))
		.join(", ");
}

export function getHostEmails() {
	return env.GOOGLE_CALENDAR_HOST_EMAILS.split(",")
		.map((email) => email.trim())
		.filter(Boolean);
}

type ResendEmailHeaders = {
	Authorization: string;
	"Content-Type": string;
	"Idempotency-Key"?: string;
};

type ResendEmailAttachment = { content: string; contentType: string; filename: string };

type ResendEmailBody = {
	from: string;
	to: string[];
	subject: string;
	html: string;
	attachments?: ResendEmailAttachment[];
};

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

	const headers: ResendEmailHeaders = {
		Authorization: `Bearer ${env.RESEND_API_KEY}`,
		"Content-Type": "application/json"
	};

	if (args.idempotencyKey) {
		headers["Idempotency-Key"] = args.idempotencyKey;
	}

	const requestBody: ResendEmailBody = {
		from: `VV Studios <${env.RESEND_FROM_EMAIL}>`,
		to: args.to,
		subject: args.subject,
		html: args.html
	};

	if (attachments) {
		requestBody.attachments = attachments;
	}

	return tryPromise({
		try: () =>
			fetch("https://api.resend.com/emails", {
				method: "POST",
				headers,
				body: JSON.stringify(requestBody)
			}),
		catch: (cause) => {
			console.error("Resend email request failed", { recipientCount: args.to.length, cause });

			return { reason: "EMAIL_REQUEST_FAILED" as const };
		}
	}).andThen((response) => {
		if (response.ok) {
			return ok(null);
		}

		return tryPromise({
			try: () => response.text(),
			catch: (cause) => {
				console.error("Resend email response body read failed", { status: response.status, cause });

				return { reason: "EMAIL_RESPONSE_FAILED" as const };
			}
		}).andThen((responseBody) => {
			console.error("Resend email response failed", {
				status: response.status,
				body: responseBody,
				recipientCount: args.to.length,
				attachmentCount: attachments?.length ?? 0
			});

			return err({ reason: "EMAIL_RESPONSE_FAILED" as const });
		});
	});
}
