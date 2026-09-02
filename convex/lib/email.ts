import { createElement } from "react";
import { render } from "@react-email/render";
import type { Doc, Id } from "#convex/_generated/dataModel";
import { CONTACT_EMAIL } from "#/config/contact";
import { BOOKING_INVOICE_BUSINESS } from "#studio/features/booking-invoice/lib/constants";
import { ClientAssetsEmail } from "#studio/features/client-assets-email/ClientAssetsEmail";
import { DeliverablesEmail } from "#studio/features/deliverables-email/DeliverablesEmail";
import { EditorAssignmentEmail } from "#studio/features/editor-assignment-email/EditorAssignmentEmail";
import type { DeliverablesEmailVariant } from "#studio/features/deliverables-email/lib/constants";
import { HostBookingDetailsEmail } from "#studio/features/host-booking-details-email/HostBookingDetailsEmail";
import { MultiBookingSchedulingEmail } from "#studio/features/multi-booking-scheduling-email/MultiBookingSchedulingEmail";
import { PackageExpiryReminderEmail } from "#studio/features/package-reminder-email/PackageExpiryReminderEmail";
import { PackagePaymentReminderEmail } from "#studio/features/package-reminder-email/PackagePaymentReminderEmail";
import { ReminderEmail } from "#studio/features/reminder-email/ReminderEmail";
import {
	formatBookingTimeRange,
	formatDriveSessionMediaFolderName,
	getEditorEditDueAt
} from "#studio/lib/bookingdatetime";
import { env } from "#convex/env";
import {
	formatSessionDateLong,
	formatSessionDateShort,
	formatSessionDateWithoutYear,
	formatCalendarEventDate
} from "./sessionCalendarTime";
import {
	createBookingInvoiceEmailArtifactsForBooking,
	createMultiBookingInvoiceArtifacts,
	createPackageAdjustmentInvoiceArtifacts,
	renderBookingInvoicePdfInNode,
	type MultiBookingInvoiceInput,
	type PackageAdjustmentInvoiceInput
} from "./bookingInvoiceArtifacts";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/bookingAddonQuantities";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { formatEditingAddonLabel } from "#studio/features/booking-form/lib/editing-addon-quantities";
import type { BookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";

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
	addons: string[];
}

interface SessionHostRescheduleDetails {
	originalDate: string;
	originalTime: string;
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
	addons: string[];
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
	addons: string[];
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

interface SendClientAssetsEmailArgs {
	assetsUrl: string;
	bookingId: Id<"bookings">;
	email: string;
	name: string;
}

interface SendEditorAssignmentEmailArgs {
	editorEmail: string;
	editorName: string;
	sessionName: string;
	sessionStartAt: number;
}

interface SendSessionDeliverablesEmailArgs {
	date: string;
	driveLink: string;
	editorNotes?: string;
	email: string;
	emailVariant: DeliverablesEmailVariant;
	name: string;
}

type SendPackageScheduleEmailArgs = {
	addons: string[];
	leadTimeMinutes: number;
	duration: string;
	email: string;
	expiresAt: number;
	name: string;
	packageSize: 4 | 8 | 12;
	bookedAt: number;
	scheduleUrl: string;
} & BookingAddonQuantitiesArgs;

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

function formatTimestampDateLong(timestamp: number) {
	return new Intl.DateTimeFormat("en-AU", {
		day: "numeric",
		month: "long",
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
		weekday: "long",
		year: "numeric"
	}).format(new Date(timestamp));
}

function formatTimestampDateShort(timestamp: number) {
	return new Intl.DateTimeFormat("en-AU", {
		day: "numeric",
		month: "long",
		timeZone: env.GOOGLE_CALENDAR_TIMEZONE,
		year: "numeric"
	}).format(new Date(timestamp));
}

function formatAddonsLine(args: { addons: string[] } & BookingAddonQuantitiesArgs) {
	if (args.addons.length === 0) {
		return "None";
	}

	return args.addons
		.map((addon) => formatEditingAddonLabel(addon, args as BookingAddonQuantities))
		.join(", ");
}

function sendEmail(args: {
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

export async function sendBookingInvoiceEmailsForBooking(
	booking: Doc<"bookings">,
	options: {
		customInvoice?: Doc<"customInvoices">;
		leadTimeMinutes: number;
		reschedule?: SessionHostRescheduleDetails;
		rescheduleUrl?: string;
	}
): Promise<
	Result<
		null,
		{ reason: "INVALID_BOOKING_DATA" | "INVOICE_EMAIL_RENDER_FAILED" | "INVOICE_SEND_FAILED" }
	>
> {
	const artifactsResult = await createBookingInvoiceEmailArtifactsForBooking(
		booking,
		booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt,
		options
	);

	if (artifactsResult.isErr()) {
		return err(artifactsResult.error);
	}

	const { artifacts, booking: parsedBooking } = artifactsResult.value;
	const pdfResult = await renderBookingInvoicePdfInNode(artifacts.data);

	if (pdfResult.isErr()) {
		console.error("Booking invoice PDF render failed", { bookingId: booking._id });
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	const pdfContent = pdfResult.value;

	const invoiceEmailResult = await sendEmail({
		to: [booking.email],
		subject: `Your Studio Booking Invoice - ${formatSessionDateShort(booking.date)}`,
		html: artifacts.emailHtml,
		attachments: [{ ...artifacts.pdf, content: pdfContent }]
	});

	if (invoiceEmailResult.isErr()) {
		console.error("Booking invoice customer email send failed", {
			bookingId: booking._id,
			bookingEmail: booking.email,
			reason: invoiceEmailResult.error.reason
		});
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	const hostEmailResult = await sendSessionHostDetailsEmail({
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
		notes: parsedBooking.notes,
		reschedule: options.reschedule
	});

	if (hostEmailResult.isErr()) {
		console.error("Booking invoice host email send failed", {
			bookingId: booking._id,
			reason: hostEmailResult.error.reason
		});
	}

	return ok(null);
}

export async function sendPackageAdjustmentInvoiceEmail(
	invoiceInput: PackageAdjustmentInvoiceInput
): Promise<
	Result<
		null,
		{ reason: "INVALID_BOOKING_DATA" | "INVOICE_EMAIL_RENDER_FAILED" | "INVOICE_SEND_FAILED" }
	>
> {
	const artifactsResult = await createPackageAdjustmentInvoiceArtifacts(invoiceInput);

	if (artifactsResult.isErr()) {
		return err(artifactsResult.error);
	}

	const artifacts = artifactsResult.value.artifacts;
	const pdfResult = await renderBookingInvoicePdfInNode(artifacts.data);

	if (pdfResult.isErr()) {
		console.error("Package adjustment invoice PDF render failed", {
			adjustmentId: invoiceInput.adjustment._id
		});
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	const invoiceEmailResult = await sendEmail({
		to: [invoiceInput.multiBooking.email],
		subject: `Your Remote Podcast Adjustment Invoice — Package Booked on ${formatTimestampDateShort(invoiceInput.multiBooking.createdAt)}`,
		html: artifacts.emailHtml,
		attachments: [{ ...artifacts.pdf, content: pdfResult.value }],
		idempotencyKey: `package-adjustment-${invoiceInput.adjustment._id}`
	});

	if (invoiceEmailResult.isErr()) {
		console.error("Package adjustment invoice email send failed", {
			adjustmentId: invoiceInput.adjustment._id,
			reason: invoiceEmailResult.error.reason
		});
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	return ok(null);
}

export async function sendMultiBookingInvoiceEmail(
	multiBooking: MultiBookingInvoiceInput,
	options: { leadTimeMinutes: number }
): Promise<
	Result<
		{ invoiceNumber: string },
		{ reason: "INVALID_BOOKING_DATA" | "INVOICE_EMAIL_RENDER_FAILED" | "INVOICE_SEND_FAILED" }
	>
> {
	const artifactsResult = await createMultiBookingInvoiceArtifacts(multiBooking, options);

	if (artifactsResult.isErr()) {
		return err(artifactsResult.error);
	}

	const artifacts = artifactsResult.value.artifacts;
	const pdfResult = await renderBookingInvoicePdfInNode(artifacts.data);

	if (pdfResult.isErr()) {
		console.error("Multi-booking invoice PDF render failed", { multiBookingId: multiBooking._id });
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	const invoiceCreatedDate = new Intl.DateTimeFormat("en-AU", {
		day: "numeric",
		month: "long",
		year: "numeric"
	}).format(new Date(multiBooking.createdAt));

	const invoiceEmailResult = await sendEmail({
		to: [multiBooking.email],
		subject: `Your ${multiBooking.packageSize} Pack Studio Booking Invoice from ${invoiceCreatedDate}`,
		html: artifacts.emailHtml,
		attachments: [{ ...artifacts.pdf, content: pdfResult.value }]
	});

	if (invoiceEmailResult.isErr()) {
		console.error("Multi-booking invoice customer email send failed", {
			multiBookingId: multiBooking._id,
			reason: invoiceEmailResult.error.reason
		});
		return err({ reason: "INVOICE_SEND_FAILED" });
	}

	const hostEmailResult = await sendPackageHostDetailsEmail({
		invoiceNumber: artifacts.data.invoice.number,
		name: multiBooking.name,
		email: multiBooking.email,
		phone: multiBooking.phone,
		accountName: multiBooking.accountName,
		abn: multiBooking.abn,
		duration: multiBooking.duration,
		addons: multiBooking.addons,
		essentialEditQuantity: multiBooking.essentialEditQuantity,
		completeEditQuantity: multiBooking.completeEditQuantity,
		clipsPackageQuantity: multiBooking.clipsPackageQuantity,
		handcraftedClipsQuantity: multiBooking.handcraftedClipsQuantity,
		notes: multiBooking.notes,
		packageSize: multiBooking.packageSize,
		invoiceDueAt: multiBooking.invoiceDueAt
	});

	if (hostEmailResult.isErr()) {
		console.error("Multi-booking invoice host email send failed", {
			multiBookingId: multiBooking._id,
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
			createElement(MultiBookingSchedulingEmail, {
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

export function sendClientAssetsEmail({
	assetsUrl,
	bookingId,
	email,
	name
}: SendClientAssetsEmailArgs) {
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	return ResultAsync.fromSafePromise(
		render(createElement(ClientAssetsEmail, { assetsUrl, name, signoffName }))
	).andThen((html) =>
		sendEmail({
			to: [email],
			subject: "Anything you'd like us to use in your video edit?",
			html,
			idempotencyKey: `client-assets:${bookingId}:${assetsUrl}`
		})
	);
}

export function sendEditorAssignmentEmail({
	editorEmail,
	editorName,
	sessionName,
	sessionStartAt
}: SendEditorAssignmentEmailArgs) {
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;
	const sessionDate = formatTimestampDateLong(sessionStartAt);
	const dueDateLabel = formatTimestampDateLong(getEditorEditDueAt(sessionStartAt));

	return ResultAsync.fromSafePromise(
		render(
			createElement(EditorAssignmentEmail, {
				clientName: sessionName,
				deliverablesFolderName: formatDriveSessionMediaFolderName("Deliverables", sessionStartAt),
				dueDateLabel,
				editorName,
				rawMediaFolderName: formatDriveSessionMediaFolderName("Raw Media", sessionStartAt),
				sessionDateLabel: sessionDate,
				signoffName
			})
		)
	).andThen((html) =>
		sendEmail({
			to: [editorEmail],
			subject: `New edit assigned: ${sessionName}, ${sessionDate}`,
			html,
			idempotencyKey: `editor-assignment:${editorEmail}:${sessionStartAt}`
		})
	);
}

export function sendSessionDeliverablesEmail({
	date,
	driveLink,
	editorNotes,
	email,
	emailVariant,
	name
}: SendSessionDeliverablesEmailArgs) {
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	return ResultAsync.fromSafePromise(
		render(
			createElement(DeliverablesEmail, {
				bookingDate: formatSessionDateWithoutYear(date),
				driveLink,
				editorNotes: editorNotes?.trim() || undefined,
				emailVariant,
				name,
				signoffName
			})
		)
	).andThen((html) =>
		sendEmail({
			to: [email],
			subject: `Your VV Studios Deliverables Folder - ${formatSessionDateShort(date)}`,
			html
		})
	);
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

export function getHostEmails() {
	return env.GOOGLE_CALENDAR_HOST_EMAILS.split(",")
		.map((email) => email.trim())
		.filter(Boolean);
}
