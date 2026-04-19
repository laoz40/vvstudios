import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { BOOKING_INVOICE_BUSINESS } from "../../src/features/booking-invoice/lib/constants";
import { env } from "../env";
import { formatCalendarEventDate, formatCalendarEventTime } from "./bookingTimeUtils";

interface BuildBookingCalendarEventRequestBodyArgs {
	name: string;
	duration: string;
	service: string;
	startDateTime: string;
	endDateTime: string;
	timeZone: string;
	hostEmails: string[];
	email: string;
}

interface ResendSendEmailSuccessResponse {
	id: string;
}

export function buildBookingCalendarEventRequestBody({
	name,
	duration,
	service,
	startDateTime,
	endDateTime,
	timeZone,
	hostEmails,
	email,
}: BuildBookingCalendarEventRequestBodyArgs): calendar_v3.Schema$Event {
	const bookingDate = formatCalendarEventDate(startDateTime, timeZone);
	const bookingTime = formatCalendarEventTime(startDateTime, timeZone);
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	return {
		summary: `Studio Hire | ${name} | ${duration}`,
		description: [
			`Hello, ${name}!`,
			"",
			"Your booking has been confirmed!",
			"",
			`Studio Hire: ${service}`,
			`With: ${BOOKING_INVOICE_BUSINESS.locationLabel}`,
			`Duration: ${duration}`,
			`Date: ${bookingDate}`,
			`Time: ${bookingTime}`,
			`Timezone: ${timeZone}`,
			"",
			"Location:",
			BOOKING_INVOICE_BUSINESS.locationAddress,
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
