import { createElement } from "react";
import { render } from "@react-email/render";
import type { Doc } from "../_generated/dataModel";
import { CONTACT_EMAIL } from "../../src/config/contact";
import { BOOKING_INVOICE_BUSINESS } from "../../src/sites/studio/features/booking-invoice/lib/constants";
import { DeliverablesEmail } from "../../src/sites/studio/features/deliverables-email/DeliverablesEmail";
import type { DeliverablesEmailVariant } from "../../src/sites/studio/features/deliverables-email/lib/constants";
import { HostBookingDetailsEmail } from "../../src/sites/studio/features/host-booking-details-email/HostBookingDetailsEmail";
import { ReminderEmail } from "../../src/sites/studio/features/reminder-email/ReminderEmail";
import { env } from "../env";
import {
	formatBookingDateLong,
	formatBookingDateShort,
	formatBookingDateWithoutYear,
	formatCalendarEventDate,
	formatCalendarEventTime
} from "./bookingCalendarTime";
import {
	createBookingInvoiceEmailArtifactsForBooking,
	createMultiBookingInvoiceArtifacts,
	renderBookingInvoicePdfInNode,
	type MultiBookingInvoiceSource
} from "./bookingInvoiceArtifacts";
import { err, ok, type Result } from "../../src/lib/result";

type SendEmailResult = Result<
	{ sent: true },
	{ reason: "EMAIL_REQUEST_FAILED" } | { reason: "EMAIL_RESPONSE_FAILED" }
>;

interface SendBookingReminderEmailForBookingArgs {
	name: string;
	email: string;
	date: string;
	startDateTime: string;
	timeZone: string;
	rescheduleUrl?: string;
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

interface SendBookingDeliverablesEmailArgs {
	date: string;
	driveLink: string;
	editorNotes?: string;
	email: string;
	emailVariant: DeliverablesEmailVariant;
	name: string;
}

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

interface EmailAttachment {
	content: Uint8Array;
	contentType: string;
	filename: string;
}

async function sendEmail(args: {
	to: string[];
	subject: string;
	html: string;
	attachments?: EmailAttachment[];
}): Promise<SendEmailResult> {
	const attachments = args.attachments?.map((attachment) => ({
		filename: attachment.filename,
		content: Buffer.from(attachment.content).toString("base64"),
		contentType: attachment.contentType
	}));

	let response: Response;

	try {
		response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.RESEND_API_KEY}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				from: `VV Studios <${env.RESEND_FROM_EMAIL}>`,
				to: args.to,
				subject: args.subject,
				html: args.html,
				...(attachments ? { attachments } : {})
			})
		});
	} catch {
		return err({ reason: "EMAIL_REQUEST_FAILED" });
	}

	if (!response.ok) {
		return err({ reason: "EMAIL_RESPONSE_FAILED" });
	}

	return ok({ sent: true });
}

export async function sendBookingHostDetailsEmail(args: SendBookingHostDetailsEmailArgs) {
	const hostEmails = getHostEmails();

	if (hostEmails.length === 0) {
		return ok({ sent: true });
	}

	const addonsLine = args.addons.length > 0 ? args.addons.join(", ") : "None";
	const html = await render(
		createElement(HostBookingDetailsEmail, {
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
			notes: args.notes
		})
	);

	return await sendEmail({
		to: hostEmails,
		subject: `New Studio Booking - ${args.name} - ${formatBookingDateShort(args.date)}`,
		html
	});
}

export async function sendBookingInvoiceEmailsForBooking(
	booking: Doc<"bookings">,
	rescheduleUrl?: string
): Promise<Result<{ sent: true }, { reason: "INVALID_BOOKING_DATA" | "INVOICE_SEND_FAILED" }>> {
	const [artifactsError, artifactsResult] = await createBookingInvoiceEmailArtifactsForBooking(
		booking,
		booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt,
		rescheduleUrl
	);

	if (artifactsError !== null) {
		return err(artifactsError);
	}

	const { artifacts, booking: parsedBooking } = artifactsResult;

	const [pdfError, pdfContent] = await renderBookingInvoicePdfInNode(artifacts.data);

	if (pdfError !== null) {
		console.error("Booking invoice PDF render failed", { bookingId: booking._id });
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	const [invoiceEmailError] = await sendEmail({
		to: [booking.email],
		subject: `Your Studio Booking Invoice - ${formatBookingDateShort(booking.date)}`,
		html: artifacts.emailHtml,
		attachments: [{ ...artifacts.pdf, content: pdfContent }]
	});

	if (invoiceEmailError !== null) {
		console.error("Booking invoice customer email send failed", {
			bookingId: booking._id,
			bookingEmail: booking.email,
			reason: invoiceEmailError.reason
		});
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	const [hostEmailError] = await sendBookingHostDetailsEmail({
		invoiceNumber: artifacts.data.invoice.number,
		name: parsedBooking.name,
		email: parsedBooking.email,
		phone: parsedBooking.phone,
		accountName: parsedBooking.accountName,
		abn: parsedBooking.abn,
		date: parsedBooking.date,
		time: parsedBooking.time,
		service: parsedBooking.service,
		duration: parsedBooking.duration,
		addons: parsedBooking.addons,
		notes: parsedBooking.notes
	});

	if (hostEmailError !== null) {
		console.error("Booking invoice host email send failed", {
			bookingId: booking._id,
			reason: hostEmailError.reason
		});
	}

	return ok({ sent: true });
}

export async function sendMultiBookingInvoiceEmail(
	multiBooking: MultiBookingInvoiceSource
): Promise<
	Result<
		{ invoiceNumber: string; sent: true },
		{ reason: "INVALID_BOOKING_DATA" | "INVOICE_SEND_FAILED" }
	>
> {
	const [artifactsError, artifactsResult] = await createMultiBookingInvoiceArtifacts(multiBooking);

	if (artifactsError !== null) {
		return err(artifactsError);
	}

	const [pdfError, pdfContent] = await renderBookingInvoicePdfInNode(
		artifactsResult.artifacts.data
	);

	if (pdfError !== null) {
		console.error("Multi-booking invoice PDF render failed", { multiBookingId: multiBooking._id });
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	const [invoiceEmailError] = await sendEmail({
		to: [multiBooking.email],
		subject: `Your ${multiBooking.packageSize}-Pack Studio Booking Invoice`,
		html: artifactsResult.artifacts.emailHtml,
		attachments: [{ ...artifactsResult.artifacts.pdf, content: pdfContent }]
	});

	if (invoiceEmailError !== null) {
		console.error("Multi-booking invoice customer email send failed", {
			multiBookingId: multiBooking._id,
			bookingEmail: multiBooking.email,
			reason: invoiceEmailError.reason
		});
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	return ok({ invoiceNumber: artifactsResult.artifacts.data.invoice.number, sent: true });
}

export async function sendFeedbackEmailForMessage(message: string) {
	return await sendEmail({
		to: [CONTACT_EMAIL],
		subject: "New VV Studios feedback",
		html: [
			"<p>You received new feedback from the VV Studios website.</p>",
			"<p><strong>Message:</strong></p>",
			`<p>${escapeHtml(message).replaceAll("\n", "<br />")}</p>`
		].join("")
	});
}

export async function sendBookingDeliverablesEmailForBooking({
	date,
	driveLink,
	editorNotes,
	email,
	emailVariant,
	name
}: SendBookingDeliverablesEmailArgs) {
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;
	const html = await render(
		createElement(DeliverablesEmail, {
			bookingDate: formatBookingDateWithoutYear(date),
			driveLink,
			editorNotes: editorNotes?.trim() || undefined,
			emailVariant,
			name,
			signoffName
		})
	);

	return await sendEmail({
		to: [email],
		subject: `Your VV Studios Deliverables Folder - ${formatBookingDateShort(date)}`,
		html
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
	rescheduleUrl
}: SendBookingReminderEmailForBookingArgs) {
	const addonsLine = addons.length > 0 ? addons.join(", ") : "None";
	const bookingDate = formatCalendarEventDate(startDateTime, timeZone);
	const bookingTime = formatCalendarEventTime(startDateTime, timeZone);
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;
	const html = await render(
		createElement(ReminderEmail, {
			addonsLine,
			bookingDate,
			bookingTime,
			duration,
			name,
			service,
			rescheduleUrl,
			signoffName
		})
	);

	return await sendEmail({
		to: [email, ...getHostEmails()],
		subject: `Reminder: Your Studio Session Tomorrow - ${formatBookingDateShort(date)}`,
		html
	});
}

export function getHostEmails() {
	return env.GOOGLE_CALENDAR_HOST_EMAILS.split(",")
		.map((email) => email.trim())
		.filter(Boolean);
}
