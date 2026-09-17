import { createElement } from "react";
import { render } from "@react-email/render";
import { okAsync, type ResultAsync } from "neverthrow";
import { tryPromise } from "#convex/lib/result";
import { CONTACT_EMAIL } from "#/config/contact";
import { BOOKING_INVOICE_BUSINESS } from "#studio/features/booking-invoice/lib/constants";
import { HostBookingDetailsEmail } from "#studio/features/host-booking-details-email/HostBookingDetailsEmail";
import { PackageExpiryReminderEmail } from "#studio/features/package-reminder-email/PackageExpiryReminderEmail";
import { ReminderEmail } from "#studio/features/reminder-email/ReminderEmail";
import { RescheduledBookingEmail } from "#studio/features/rescheduled-booking-email/RescheduledBookingEmail";
import { formatBookingTimeRange } from "#studio/lib/bookingdatetime";
import {
	formatSessionDateLong,
	formatSessionDateShort,
	formatCalendarEventDate
} from "#convex/lib/sessionCalendarTime";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/bookingAddonQuantities";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import {
	escapeHtml,
	formatAddonsLine,
	formatTimestampDateLong,
	formatTimestampDateShort,
	getHostEmails,
	sendEmail
} from "#convex/lib/emailSend";

interface SendBookingReminderEmailForBookingArgs {
	name: string;
	email: string;
	date: string;
	startDateTime: string;
	time: string;
	timeZone: string;
	rescheduleUrl?: string;
	isPackageSession?: boolean;
	service: string;
	duration: string;
	addons: BookingAddon[];
}

interface SessionHostRescheduleDetails {
	originalDate: string;
	originalTime: string;
}

interface SendBookingRescheduledCustomerEmailArgs {
	addons: BookingAddon[];
	date: string;
	duration: string;
	email: string;
	name: string;
	originalDate: string;
	originalTime: string;
	rescheduleUrl?: string;
	service: string;
	time: string;
}

interface SendSessionHostDetailsEmailArgs {
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
	addons: BookingAddon[];
	notes?: string;
	reschedule?: SessionHostRescheduleDetails;
}

type SendPackageHostDetailsEmailArgs = {
	invoiceNumber: string;
	name: string;
	email: string;
	phone: string;
	accountName: string;
	abn?: string;
	duration: string;
	addons: BookingAddon[];
	notes?: string;
	packageSize: 4 | 8 | 12;
	invoiceDueAt: number;
} & BookingAddonQuantitiesArgs;

interface SendPackageExpiryReminderEmailArgs {
	email: string;
	expiresAt: number;
	name: string;
	remainingSessions: number;
}

export function sendSessionHostDetailsEmail(args: SendSessionHostDetailsEmailArgs) {
	const hostEmails = getHostEmails();

	if (hostEmails.length === 0) {
		return okAsync(null);
	}

	const addonsLine = args.addons.length > 0 ? args.addons.join(", ") : "None";

	const bookingDetails = {
		invoiceNumber: args.invoiceNumber,
		name: args.name,
		email: args.email,
		phone: args.phone,
		accountName: args.accountName,
		abn: args.abn,
		date: formatSessionDateLong(args.date),
		time: formatBookingTimeRange(args.time, args.duration),
		service: args.service,
		duration: args.duration,
		addonsLine,
		notes: args.notes
	};

	const emailElement = args.reschedule
		? createElement(HostBookingDetailsEmail, {
				...bookingDetails,
				kind: "rescheduled",
				originalDate: formatSessionDateLong(args.reschedule.originalDate),
				originalTime: formatBookingTimeRange(args.reschedule.originalTime, args.duration)
			})
		: createElement(HostBookingDetailsEmail, bookingDetails);

	const subjectPrefix = args.reschedule ? "Studio Booking Rescheduled" : "New Studio Booking";

	return tryPromise({
		try: () => render(emailElement),
		catch: (cause) => {
			console.error("Session host details email render failed", {
				invoiceNumber: args.invoiceNumber,
				cause
			});

			return { reason: "EMAIL_RENDER_FAILED" as const };
		}
	}).andThen((html) =>
		sendEmail({
			to: hostEmails,
			subject: `${subjectPrefix} - ${args.name} - ${formatSessionDateShort(args.date)}`,
			html
		}).map(() => null)
	);
}

export function sendPackageHostDetailsEmail(args: SendPackageHostDetailsEmailArgs) {
	const hostEmails = getHostEmails();

	if (hostEmails.length === 0) {
		return okAsync(null);
	}

	return tryPromise({
		try: () =>
			render(
				createElement(HostBookingDetailsEmail, {
					kind: "package",
					invoiceNumber: args.invoiceNumber,
					name: args.name,
					email: args.email,
					phone: args.phone,
					accountName: args.accountName,
					abn: args.abn,
					duration: args.duration,
					addonsLine: formatAddonsLine({
						addons: args.addons,
						clipsPackageQuantity: args.clipsPackageQuantity,
						essentialEditQuantity: args.essentialEditQuantity
					}),
					notes: args.notes,
					packageSize: args.packageSize,
					invoiceDueAtLabel: formatTimestampDateLong(args.invoiceDueAt)
				})
			),
		catch: (cause) => {
			console.error("Package host details email render failed", {
				invoiceNumber: args.invoiceNumber,
				cause
			});

			return { reason: "EMAIL_RENDER_FAILED" as const };
		}
	}).andThen((html) =>
		sendEmail({
			to: hostEmails,
			subject: `New Package Booking Request - ${args.name} - ${args.packageSize} Pack`,
			html
		}).map(() => null)
	);
}

export function sendBookingRescheduledCustomerEmail({
	addons,
	date,
	duration,
	email,
	name,
	originalDate,
	originalTime,
	rescheduleUrl,
	service,
	time
}: SendBookingRescheduledCustomerEmailArgs): ResultAsync<
	null,
	| { reason: "EMAIL_RENDER_FAILED" }
	| { reason: "EMAIL_REQUEST_FAILED" }
	| { reason: "EMAIL_RESPONSE_FAILED" }
> {
	const addonsLine = addons.length > 0 ? addons.join(", ") : "None";

	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	return tryPromise({
		try: () =>
			render(
				createElement(RescheduledBookingEmail, {
					addonsLine,
					bookingDate: formatSessionDateLong(date),
					bookingTime: formatBookingTimeRange(time, duration),
					duration,
					name,
					originalBookingDate: formatSessionDateLong(originalDate),
					originalBookingTime: formatBookingTimeRange(originalTime, duration),
					rescheduleUrl,
					service,
					signoffName
				})
			),
		catch: (cause) => {
			console.error("Booking reschedule customer email render failed", {
				bookingEmail: email,
				cause
			});

			return { reason: "EMAIL_RENDER_FAILED" as const };
		}
	}).andThen((html) =>
		sendEmail({
			to: [email],
			subject: `Your Studio Booking Has Been Rescheduled - ${formatSessionDateShort(date)}`,
			html
		}).map(() => null)
	);
}

export function sendPackageExpiryReminderEmail({
	email,
	expiresAt,
	name,
	remainingSessions
}: SendPackageExpiryReminderEmailArgs) {
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	return tryPromise({
		try: () =>
			render(
				createElement(PackageExpiryReminderEmail, {
					expiresAtLabel: formatTimestampDateLong(expiresAt),
					name,
					remainingSessions,
					signoffName
				})
			),
		catch: (cause) => {
			console.error("Package expiry reminder email render failed", { email, cause });

			return { reason: "EMAIL_RENDER_FAILED" as const };
		}
	}).andThen((html) =>
		sendEmail({
			to: [email],
			subject: `Reminder: Schedule Your Remaining Package Sessions — Expires ${formatTimestampDateShort(expiresAt)}`,
			html
		})
	);
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

export function sendSessionReminderEmail({
	name,
	email,
	date,
	startDateTime,
	time,
	timeZone,
	service,
	duration,
	addons,
	isPackageSession,
	rescheduleUrl
}: SendBookingReminderEmailForBookingArgs) {
	const addonsLine = addons.length > 0 ? addons.join(", ") : "None";
	const bookingDate = formatCalendarEventDate(startDateTime, timeZone);
	const bookingTime = formatBookingTimeRange(time, duration);

	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	return tryPromise({
		try: () =>
			render(
				createElement(ReminderEmail, {
					addonsLine,
					bookingDate,
					bookingTime,
					duration,
					name,
					service,
					rescheduleUrl,
					isPackageSession,
					signoffName
				})
			),
		catch: (cause) => {
			console.error("Session reminder email render failed", { email, cause });

			return { reason: "EMAIL_RENDER_FAILED" as const };
		}
	}).andThen((html) =>
		sendEmail({
			to: [email, ...getHostEmails()],
			subject: `Reminder: Your Studio Session Tomorrow - ${formatSessionDateShort(date)}`,
			html
		}).map(() => null)
	);
}
