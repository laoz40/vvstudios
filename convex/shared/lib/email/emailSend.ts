import { err, ok, okAsync, ResultAsync, type Result } from "neverthrow";
import { tryPromise } from "#convex/shared/lib/result";
import { formatEditingAddonLabel } from "#/domain/booking/addon-quantities";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";
import type { BookingAddonQuantitiesArgs } from "#convex/booking/lib/addonQuantities";
import { env } from "#convex/env";
import { logError, type LogContext } from "#convex/shared/lib/logger";

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

export type EmailRequestError = { reason: "EMAIL_REQUEST_FAILED" };

export type EmailResponseError = { reason: "EMAIL_RESPONSE_FAILED" };

export function requestEmail(args: {
	to: string[];
	subject: string;
	html: string;
	attachments?: EmailAttachment[];
	idempotencyKey?: string;
	logContext: LogContext;
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
			const failure = { reason: "EMAIL_REQUEST_FAILED" } as const;

			logError({ ...args.logContext, ...failure, recipientCount: args.to.length }, cause);

			return failure;
		}
	});
}

export function readEmailResponseBody(response: Response, logContext: LogContext) {
	return tryPromise({
		try: () => response.text(),
		catch: (cause) => {
			const failure = { reason: "EMAIL_RESPONSE_FAILED" } as const;

			logError({ ...logContext, ...failure, status: response.status }, cause);

			return failure;
		}
	});
}

export function rejectEmailResponse(
	response: Response,
	responseBody: string,
	recipientCount: number,
	attachmentCount: number,
	logContext: LogContext
) {
	const failure = { reason: "EMAIL_RESPONSE_FAILED" } as const;

	logError({
		...logContext,
		...failure,
		status: response.status,
		providerResponse: responseBody.slice(0, 2000),
		recipientCount,
		attachmentCount
	});

	return err(failure);
}

// Sending an email is one external operation, including inspecting its HTTP response.
async function sendEmailRequest(
	args: Parameters<typeof requestEmail>[0]
): Promise<Result<null, EmailRequestError | EmailResponseError>> {
	const request = await requestEmail(args);

	if (request.isErr()) return err(request.error);
	const response = request.value;

	if (response.ok) return ok(null);
	const body = await readEmailResponseBody(response, args.logContext);

	if (body.isErr()) return err(body.error);

	return rejectEmailResponse(
		response,
		body.value,
		args.to.length,
		args.attachments?.length ?? 0,
		args.logContext
	);
}

export function sendEmail(args: Parameters<typeof requestEmail>[0]) {
	return new ResultAsync(sendEmailRequest(args));
}

export function sendEmailIfPresent(args: Parameters<typeof requestEmail>[0] | null) {
	return args === null ? okAsync(null) : sendEmail(args);
}
