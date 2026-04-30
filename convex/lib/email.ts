import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { BOOKING_INVOICE_BUSINESS } from "../../src/features/booking-invoice/lib/constants";
import { env } from "../env";
import {
	formatBookingDateShort,
	formatCalendarEventDate,
	formatCalendarEventTime,
} from "./bookingTimeUtils";
import { escapeHtml, getHostEmails } from "./emailFormatting";

interface BuildBookingCalendarEventRequestBodyArgs {
	name: string;
	duration: string;
	service: string;
	addons: string[];
	startDateTime: string;
	endDateTime: string;
	timeZone: string;
	hostEmails: string[];
	email: string;
}

interface ResendSendEmailSuccessResponse {
	id: string;
}

interface SendBookingReminderEmailForBookingArgs {
	name: string;
	email: string;
	date: string;
	startDateTime: string;
	timeZone: string;
	service: string;
	duration: string;
	addons: string[];
}

export function buildBookingCalendarEventRequestBody({
	name,
	duration,
	service,
	addons,
	startDateTime,
	endDateTime,
	timeZone,
	hostEmails,
	email,
}: BuildBookingCalendarEventRequestBodyArgs): calendar_v3.Schema$Event {
	const bookingDate = formatCalendarEventDate(startDateTime, timeZone);
	const bookingTime = formatCalendarEventTime(startDateTime, timeZone);
	const addonsLine = addons.length > 0 ? addons.join(", ") : "None";
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	return {
		summary: `Studio Hire | ${name} | ${duration}`,
		description: [
			`Hello, ${name}!`,
			"",
			"Your studio hire booking has been confirmed!",
			"",
			`Recording Space: ${service}`,
			`Add-ons: ${addonsLine}`,
			`Session Duration: ${duration}`,
			"",
			`Date: ${bookingDate}`,
			`Time: ${bookingTime}`,
			`Timezone: ${timeZone}`,
			"",
			"Thanks,",
			signoffName,
			BOOKING_INVOICE_BUSINESS.locationLabel,
		].join("\n"),
		location: BOOKING_INVOICE_BUSINESS.locationAddress,
		start: {
			dateTime: startDateTime,
		},
		end: {
			dateTime: endDateTime,
		},
		transparency: "opaque",
		attendees: [{ email }, ...hostEmails.map((hostEmail) => ({ email: hostEmail }))],
	};
}

export async function sendBookingInvoiceEmail(args: {
	to: string;
	subject: string;
	html: string;
	attachment: {
		content: Uint8Array;
		contentType: string;
		filename: string;
	};
}) {
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: `VV Podcast Studio <${env.RESEND_FROM_EMAIL}>`,
			to: [args.to],
			subject: args.subject,
			html: args.html,
			attachments: [
				{
					filename: args.attachment.filename,
					content: Buffer.from(args.attachment.content).toString("base64"),
					contentType: args.attachment.contentType,
				},
			],
		}),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(`Resend request failed (${response.status}): ${errorBody}`);
	}

	return (await response.json()) as ResendSendEmailSuccessResponse;
}

export async function sendBookingReminderEmail(args: {
	to: string[];
	subject: string;
	html: string;
}) {
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: `VV Podcast Studio <${env.RESEND_FROM_EMAIL}>`,
			to: args.to,
			subject: args.subject,
			html: args.html,
		}),
	});

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(`Resend request failed (${response.status}): ${errorBody}`);
	}

	return (await response.json()) as ResendSendEmailSuccessResponse;
}

export async function sendBookingReminderEmailForBooking({
	name,
	email,
	date,
	startDateTime,
	timeZone,
	service,
	duration,
	addons,
}: SendBookingReminderEmailForBookingArgs) {
	const addonsLine = addons.length > 0 ? addons.join(", ") : "None";
	const bookingDate = formatCalendarEventDate(startDateTime, timeZone);
	const bookingTime = formatCalendarEventTime(startDateTime, timeZone);
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	await sendBookingReminderEmail({
		to: [email, ...getHostEmails()],
		subject: `Reminder: Your Studio Session Tomorrow - ${formatBookingDateShort(date)}`,
		html: [
			`<p>Hello ${escapeHtml(name)},</p>`,
			"<p>This is a reminder that your studio session is scheduled for tomorrow.</p>",
			"<ul>",
			`<li><strong>Session Date:</strong> ${escapeHtml(bookingDate)}</li>`,
			`<li><strong>Session Time:</strong> ${escapeHtml(bookingTime)}</li>`,
			"</ul>",
			"<ul>",
			`<li><strong>Recording Space:</strong> ${escapeHtml(service)}</li>`,
			`<li><strong>Session Duration:</strong> ${escapeHtml(duration)}</li>`,
			`<li><strong>Add-ons:</strong> ${escapeHtml(addonsLine)}</li>`,
			"</ul>",
			"<ul>",
			`<li><strong>Location:</strong> ${escapeHtml(BOOKING_INVOICE_BUSINESS.locationAddress)}</li>`,
			"</ul>",
			"<p>Payment is due at the end of your session.</p>",
			`<p>Thanks,<br>${escapeHtml(signoffName)}<br>${escapeHtml(BOOKING_INVOICE_BUSINESS.locationLabel)}</p>`,
		].join(""),
	});
}
