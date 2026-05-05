import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { BOOKING_INVOICE_BUSINESS } from "../../src/features/booking-invoice/lib/constants";
import { renderHostBookingDetailsEmail } from "#/features/host-booking-details-email/render-host-booking-details-email";
import { renderReminderEmail } from "#/features/reminder-email/render-reminder-email";
import { env } from "../env";
import {
	formatBookingDateLong,
	formatBookingDateShort,
	formatCalendarEventDate,
	formatCalendarEventTime,
} from "./bookingCalendarTime";

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

interface SendBookingHostDetailsEmailArgs {
	invoiceNumber: string;
	name: string;
	email: string;
	phone: string;
	accountName: string;
	abn?: string;
	date: string;
	time: string;
	service: string;
	duration: string;
	addons: string[];
	notes?: string;
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
			from: `VV Studios <${env.RESEND_FROM_EMAIL}>`,
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
	return await sendEmail({
		to: args.to,
		subject: args.subject,
		html: args.html,
	});
}

async function sendEmail(args: { to: string[]; subject: string; html: string }) {
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: `VV Studios <${env.RESEND_FROM_EMAIL}>`,
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

export async function sendBookingHostDetailsEmail(args: SendBookingHostDetailsEmailArgs) {
	const hostEmails = getHostEmails();

	if (hostEmails.length === 0) {
		return null;
	}

	const addonsLine = args.addons.length > 0 ? args.addons.join(", ") : "None";
	const html = await renderHostBookingDetailsEmail({
		invoiceNumber: args.invoiceNumber,
		name: args.name,
		email: args.email,
		phone: args.phone,
		accountName: args.accountName,
		abn: args.abn,
		date: formatBookingDateLong(args.date),
		time: args.time,
		service: args.service,
		duration: args.duration,
		addonsLine,
		notes: args.notes,
	});

	return await sendEmail({
		to: hostEmails,
		subject: `New Studio Booking - ${args.name} - ${formatBookingDateShort(args.date)}`,
		html,
	});
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
	const html = await renderReminderEmail({
		addonsLine,
		bookingDate,
		bookingTime,
		duration,
		name,
		service,
		signoffName,
	});

	await sendBookingReminderEmail({
		to: [email, ...getHostEmails()],
		subject: `Reminder: Your Studio Session Tomorrow - ${formatBookingDateShort(date)}`,
		html,
	});
}

export function getHostEmails() {
	return env.GOOGLE_CALENDAR_HOST_EMAILS.split(",")
		.map((email) => email.trim())
		.filter(Boolean);
}
