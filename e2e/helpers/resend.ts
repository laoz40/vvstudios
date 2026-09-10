import { z } from "zod";

const INVOICE_SUBJECT_PREFIX = "Your Studio Booking Invoice -";

const PACKAGE_SCHEDULE_SUBJECT_PREFIX = "Schedule Your ";

const RESCHEDULE_URL_PATTERN = /https?:\/\/[^\s"'<>]+\/reschedule\/[a-f0-9]{64}/i;

const PACKAGE_SCHEDULE_URL_PATTERN = /https?:\/\/[^\s"'<>]+\/package-schedule\/[a-f0-9]{64}/i;

const resendEmailListItemSchema = z.object({
	created_at: z.string(),
	id: z.string(),
	subject: z.string(),
	to: z.array(z.string())
});

const resendEmailListResponseSchema = z.object({
	data: z.array(resendEmailListItemSchema),
	has_more: z.boolean()
});

const resendEmailDetailResponseSchema = z.object({ html: z.string().nullable() });

type ResendEmailListItem = z.infer<typeof resendEmailListItemSchema>;

function sleep(ms: number) {
	return new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});
}

function parseResendTimestamp(value: string) {
	// Resend uses "YYYY-MM-DD HH:mm:ss.ffffff+00"; Date needs "T" and "Z" (or "+00:00").
	const normalized = value.trim().replace(" ", "T").replace(/\+00$/, "Z");
	const parsed = new Date(normalized);

	if (Number.isNaN(parsed.getTime())) {
		throw new Error(`Unparseable Resend timestamp: ${value}`);
	}

	return parsed;
}

function recipientMatches(recipients: string[], recipient: string) {
	return recipients.some((address) => address.toLowerCase() === recipient.toLowerCase());
}

function isEmailSince(email: ResendEmailListItem, recipient: string, since: Date) {
	if (!recipientMatches(email.to, recipient)) {
		return false;
	}

	return parseResendTimestamp(email.created_at) >= since;
}

function isInvoiceEmail(email: ResendEmailListItem, recipient: string, since: Date) {
	if (!isEmailSince(email, recipient, since)) {
		return false;
	}

	return email.subject.startsWith(INVOICE_SUBJECT_PREFIX);
}

function isPackageScheduleEmail(
	email: ResendEmailListItem,
	recipient: string,
	since: Date,
	packageSize: number
) {
	if (!isEmailSince(email, recipient, since)) {
		return false;
	}

	return email.subject.startsWith(
		`${PACKAGE_SCHEDULE_SUBJECT_PREFIX}${packageSize} Pack Studio Sessions`
	);
}

async function parseResendResponse<T>(response: Response, schema: z.ZodType<T>) {
	const json: unknown = await response.json();

	return schema.parse(json);
}

async function listSentEmails(apiKey: string, after?: string) {
	const url = new URL("https://api.resend.com/emails");

	if (after) {
		url.searchParams.set("after", after);
	}

	const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Resend API /emails failed (${response.status}): ${body}`);
	}

	return parseResendResponse(response, resendEmailListResponseSchema);
}

async function fetchEmailDetail(apiKey: string, emailId: string) {
	const response = await fetch(`https://api.resend.com/emails/${emailId}`, {
		headers: { Authorization: `Bearer ${apiKey}` }
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Resend API /emails/${emailId} failed (${response.status}): ${body}`);
	}

	return parseResendResponse(response, resendEmailDetailResponseSchema);
}

async function findMatchingEmailInPages({
	after,
	apiKey,
	isMatch
}: {
	after?: string;
	apiKey: string;
	isMatch: (email: ResendEmailListItem) => boolean;
}): Promise<ResendEmailListItem | null> {
	const page = await listSentEmails(apiKey, after);

	for (const email of page.data) {
		if (isMatch(email)) {
			return email;
		}
	}

	if (!page.has_more || page.data.length === 0) {
		return null;
	}

	const nextAfter = page.data.at(-1)?.id;

	if (!nextAfter) {
		return null;
	}

	return findMatchingEmailInPages({ after: nextAfter, apiKey, isMatch });
}

function extractUrlFromHtml(html: string, pattern: RegExp) {
	const match = html.match(pattern);

	return match?.[0] ?? null;
}

async function pollForEmailUrl({
	apiKey,
	deadline,
	extractUrl,
	findEmail,
	notFoundMessage,
	pollIntervalMs,
	recipient,
	since,
	timeoutMs
}: {
	apiKey: string;
	deadline: number;
	extractUrl: (html: string) => string | null;
	findEmail: () => Promise<ResendEmailListItem | null>;
	notFoundMessage: string;
	pollIntervalMs: number;
	recipient: string;
	since: Date;
	timeoutMs: number;
}) {
	const email = await findEmail();

	if (email) {
		const detail = await fetchEmailDetail(apiKey, email.id);
		const url = detail.html ? extractUrl(detail.html) : null;

		if (url) {
			return url;
		}
	}

	if (Date.now() >= deadline) {
		throw new Error(notFoundMessage);
	}

	await sleep(pollIntervalMs);

	return pollForEmailUrl({
		apiKey,
		deadline,
		extractUrl,
		findEmail,
		notFoundMessage,
		pollIntervalMs,
		recipient,
		since,
		timeoutMs
	});
}

export async function waitForInvoiceRescheduleUrl({
	apiKey,
	recipient,
	since,
	timeoutMs = 120_000,
	pollIntervalMs = 3_000
}: {
	apiKey: string;
	pollIntervalMs?: number;
	recipient: string;
	since: Date;
	timeoutMs?: number;
}) {
	return pollForEmailUrl({
		apiKey,
		deadline: Date.now() + timeoutMs,
		extractUrl: (html) => extractUrlFromHtml(html, RESCHEDULE_URL_PATTERN),
		findEmail: () =>
			findMatchingEmailInPages({
				apiKey,
				isMatch: (email) => isInvoiceEmail(email, recipient, since)
			}),
		notFoundMessage: `Invoice email with reschedule link not found for ${recipient} within ${timeoutMs}ms`,
		pollIntervalMs,
		recipient,
		since,
		timeoutMs
	});
}

export async function waitForPackageScheduleUrl({
	apiKey,
	packageSize,
	recipient,
	since,
	timeoutMs = 120_000,
	pollIntervalMs = 3_000
}: {
	apiKey: string;
	packageSize: number;
	pollIntervalMs?: number;
	recipient: string;
	since: Date;
	timeoutMs?: number;
}) {
	return pollForEmailUrl({
		apiKey,
		deadline: Date.now() + timeoutMs,
		extractUrl: (html) => extractUrlFromHtml(html, PACKAGE_SCHEDULE_URL_PATTERN),
		findEmail: () =>
			findMatchingEmailInPages({
				apiKey,
				isMatch: (email) => isPackageScheduleEmail(email, recipient, since, packageSize)
			}),
		notFoundMessage: `Package scheduling email not found for ${recipient} within ${timeoutMs}ms`,
		pollIntervalMs,
		recipient,
		since,
		timeoutMs
	});
}
