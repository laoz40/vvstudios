import { createElement } from "react";
import { render } from "@react-email/render";
import { err, ok, type Result } from "neverthrow";
import { CONTACT_EMAIL } from "#/config/contact";
import { BOOKING_INVOICE_BUSINESS } from "#studio/features/booking-invoice/lib/constants";
import { HostBookingDetailsEmail } from "#studio/features/host-booking-details-email/HostBookingDetailsEmail";
import { PackageSchedulingEmail } from "#studio/features/package-scheduling-email/PackageSchedulingEmail";
import { PackageExpiryReminderEmail } from "#studio/features/package-reminder-email/PackageExpiryReminderEmail";
import { PackagePaymentReminderEmail } from "#studio/features/package-reminder-email/PackagePaymentReminderEmail";
import { ReminderEmail } from "#studio/features/reminder-email/ReminderEmail";
import { RescheduledBookingEmail } from "#studio/features/rescheduled-booking-email/RescheduledBookingEmail";
import { formatBookingTimeRange } from "#studio/lib/bookingdatetime";
import {
	formatSessionDateLong,
	formatSessionDateShort,
	formatCalendarEventDate
} from "#convex/lib/sessionCalendarTime";
import {
	createPackageInvoiceArtifacts,
	renderBookingInvoicePdfInNode,
	type PackageInvoiceInput
} from "#convex/lib/bookingInvoiceArtifacts";
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

interface SendPackagePaymentReminderEmailArgs {
	email: string;
	invoiceDueAt: number;
	name: string;
	requestDate: number;
}

interface SendPackageExpiryReminderEmailArgs {
	email: string;
	expiresAt: number;
	name: string;
	remainingSessions: number;
}

type SendPackageScheduleEmailArgs = {
	addons: BookingAddon[];
	leadTimeMinutes: number;
	duration: string;
	email: string;
	expiresAt: number;
	name: string;
	packageSize: 4 | 8 | 12;
	bookedAt: number;
	scheduleUrl: string;
} & BookingAddonQuantitiesArgs;

export async function sendSessionHostDetailsEmail(args: SendSessionHostDetailsEmailArgs) {
	const hostEmails = getHostEmails();

	if (hostEmails.length === 0) {
		return ok(null);
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

	const html = await render(emailElement);

	const subjectPrefix = args.reschedule ? "Studio Booking Rescheduled" : "New Studio Booking";

	return await sendEmail({
		to: hostEmails,
		subject: `${subjectPrefix} - ${args.name} - ${formatSessionDateShort(args.date)}`,
		html
	});
}

export async function sendPackageHostDetailsEmail(args: SendPackageHostDetailsEmailArgs) {
	const hostEmails = getHostEmails();

	if (hostEmails.length === 0) {
		return ok(null);
	}

	const html = await render(
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
	);

	return await sendEmail({
		to: hostEmails,
		subject: `New Package Booking Request - ${args.name} - ${args.packageSize} Pack`,
		html
	});
}

export async function sendBookingRescheduledCustomerEmail({
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
}: SendBookingRescheduledCustomerEmailArgs): Promise<
	Result<null, { reason: "RESCHEDULE_EMAIL_SEND_FAILED" }>
> {
	const addonsLine = addons.length > 0 ? addons.join(", ") : "None";

	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	const html = await render(
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
	);

	const emailResult = await sendEmail({
		to: [email],
		subject: `Your Studio Booking Has Been Rescheduled - ${formatSessionDateShort(date)}`,
		html
	});

	if (emailResult.isErr()) {
		console.error("Booking reschedule customer email send failed", {
			bookingEmail: email,
			reason: emailResult.error.reason
		});

		return err({ reason: "RESCHEDULE_EMAIL_SEND_FAILED" });
	}

	return ok(null);
}

export async function sendPackageInvoiceEmail(
	packageRecord: PackageInvoiceInput,
	options: { leadTimeMinutes: number }
): Promise<
	Result<
		{ invoiceNumber: string },
		{ reason: "INVALID_BOOKING_DATA" | "INVOICE_EMAIL_RENDER_FAILED" | "INVOICE_SEND_FAILED" }
	>
> {
	const artifactsResult = await createPackageInvoiceArtifacts(packageRecord, options);

	if (artifactsResult.isErr()) {
		return err(artifactsResult.error);
	}

	const artifacts = artifactsResult.value.artifacts;
	const pdfResult = await renderBookingInvoicePdfInNode(artifacts.data);

	if (pdfResult.isErr()) {
		console.error("Multi-booking invoice PDF render failed", { packageId: packageRecord._id });

		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	const invoiceCreatedDate = new Intl.DateTimeFormat("en-AU", {
		day: "numeric",
		month: "long",
		year: "numeric"
	}).format(new Date(packageRecord.createdAt));

	const invoiceEmailResult = await sendEmail({
		to: [packageRecord.email],
		subject: `Your ${packageRecord.packageSize} Pack Studio Booking Invoice from ${invoiceCreatedDate}`,
		html: artifacts.emailHtml,
		attachments: [{ ...artifacts.pdf, content: pdfResult.value }]
	});

	if (invoiceEmailResult.isErr()) {
		console.error("Multi-booking invoice customer email send failed", {
			packageId: packageRecord._id,
			reason: invoiceEmailResult.error.reason
		});

		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	const hostEmailResult = await sendPackageHostDetailsEmail({
		invoiceNumber: artifacts.data.invoice.number,
		name: packageRecord.name,
		email: packageRecord.email,
		phone: packageRecord.phone,
		accountName: packageRecord.accountName,
		abn: packageRecord.abn,
		duration: packageRecord.duration,
		addons: packageRecord.addons,
		essentialEditQuantity: packageRecord.essentialEditQuantity,
		completeEditQuantity: packageRecord.completeEditQuantity,
		clipsPackageQuantity: packageRecord.clipsPackageQuantity,
		handcraftedClipsQuantity: packageRecord.handcraftedClipsQuantity,
		notes: packageRecord.notes,
		packageSize: packageRecord.packageSize,
		invoiceDueAt: packageRecord.invoiceDueAt ?? packageRecord.createdAt
	});

	if (hostEmailResult.isErr()) {
		console.error("Multi-booking invoice host email send failed", {
			packageId: packageRecord._id,
			reason: hostEmailResult.error.reason
		});
	}

	return ok({ invoiceNumber: artifacts.data.invoice.number });
}

export async function sendPackageScheduleEmail({
	addons,
	clipsPackageQuantity,
	completeEditQuantity,
	duration,
	email,
	essentialEditQuantity,
	handcraftedClipsQuantity,
	expiresAt,
	name,
	packageSize,
	leadTimeMinutes,
	bookedAt,
	scheduleUrl
}: SendPackageScheduleEmailArgs): Promise<
	Result<null, { reason: "SCHEDULE_EMAIL_RENDER_FAILED" | "SCHEDULE_EMAIL_SEND_FAILED" }>
> {
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	let html: string;

	try {
		html = await render(
			createElement(PackageSchedulingEmail, {
				addonsLine: formatAddonsLine({
					addons,
					clipsPackageQuantity,
					completeEditQuantity,
					essentialEditQuantity,
					handcraftedClipsQuantity
				}),
				duration,
				expiresAtLabel: formatTimestampDateLong(expiresAt),
				name,
				packageSize,
				leadTimeMinutes,
				scheduleUrl,
				signoffName
			})
		);
	} catch {
		return err({ reason: "SCHEDULE_EMAIL_RENDER_FAILED" });
	}

	const scheduleEmailResult = await sendEmail({
		to: [email],
		subject: `Schedule Your ${packageSize} Pack Studio Sessions — Booked ${formatTimestampDateShort(bookedAt)}`,
		html
	});

	if (scheduleEmailResult.isErr()) {
		console.error("Multi-booking schedule email send failed", {
			email,
			reason: scheduleEmailResult.error.reason
		});

		return err({ reason: "SCHEDULE_EMAIL_SEND_FAILED" });
	}

	return ok(null);
}

export async function sendPackagePaymentReminderEmail({
	email,
	invoiceDueAt,
	name,
	requestDate
}: SendPackagePaymentReminderEmailArgs) {
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	const html = await render(
		createElement(PackagePaymentReminderEmail, {
			invoiceDueAtLabel: formatTimestampDateLong(invoiceDueAt),
			name,
			requestDateLabel: formatTimestampDateLong(requestDate),
			signoffName
		})
	);

	return await sendEmail({
		to: [email],
		subject: `Reminder: Complete Your Package Payment — Requested ${formatTimestampDateShort(requestDate)}`,
		html
	});
}

export async function sendPackageExpiryReminderEmail({
	email,
	expiresAt,
	name,
	remainingSessions
}: SendPackageExpiryReminderEmailArgs) {
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	const html = await render(
		createElement(PackageExpiryReminderEmail, {
			expiresAtLabel: formatTimestampDateLong(expiresAt),
			name,
			remainingSessions,
			signoffName
		})
	);

	return await sendEmail({
		to: [email],
		subject: `Reminder: Schedule Your Remaining Package Sessions — Expires ${formatTimestampDateShort(expiresAt)}`,
		html
	});
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

export async function sendSessionReminderEmail({
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

	const html = await render(
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
	);

	const emailResult = await sendEmail({
		to: [email, ...getHostEmails()],
		subject: `Reminder: Your Studio Session Tomorrow - ${formatSessionDateShort(date)}`,
		html
	});

	return emailResult;
}
