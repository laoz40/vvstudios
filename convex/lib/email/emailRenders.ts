import { createElement } from "react";
import { render } from "@react-email/render";
import { BOOKING_INVOICE_BUSINESS } from "#studio/features/booking-invoice/lib/constants";
import { DeliverablesReviewReadyEmail } from "#studio/features/deliverables-review-ready-email/DeliverablesReviewReadyEmail";
import { HostBookingDetailsEmail } from "#studio/features/host-booking-details-email/HostBookingDetailsEmail";
import { PackageExpiryReminderEmail } from "#studio/features/package-reminder-email/PackageExpiryReminderEmail";
import { ReminderEmail } from "#studio/features/reminder-email/ReminderEmail";
import { RescheduledBookingEmail } from "#studio/features/rescheduled-booking-email/RescheduledBookingEmail";
import { ClientAssetsEmail } from "#studio/features/client-assets-email/ClientAssetsEmail";
import { DeliverablesEmail } from "#studio/features/deliverables-email/DeliverablesEmail";
import { EditorAssignmentEmail } from "#studio/features/editor-assignment-email/EditorAssignmentEmail";
import type { DeliverablesEmailVariant } from "#studio/features/deliverables-email/lib/constants";
import { formatBookingTimeRange } from "#studio/lib/bookingdatetime";
import { formatDriveSessionMediaFolderName, getEditorEditDueAt } from "#studio/lib/bookingdatetime";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/booking/bookingAddonQuantities";
import {
	pickBookingAddonQuantities,
	type BookingAddon
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	formatSessionDateLong,
	formatSessionDateShort,
	formatSessionDateWithoutYear,
	formatCalendarEventDate
} from "#convex/lib/sessions/sessionCalendarTime";
import {
	formatAddonsLine,
	formatTimestampDateLong,
	formatTimestampDateShort
} from "#convex/lib/email/emailSend";
import { tryPromise } from "#convex/lib/result";

type SendBookingReminderEmailForBookingArgs = {
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
} & BookingAddonQuantitiesArgs;

interface SessionHostRescheduleDetails {
	originalDate: string;
	originalTime: string;
}

export type SendBookingRescheduledCustomerEmailArgs = {
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
} & BookingAddonQuantitiesArgs;

export type SendSessionHostDetailsEmailArgs = {
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
} & BookingAddonQuantitiesArgs;

export type SendPackageHostDetailsEmailArgs = {
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

export type SendDeliverablesReviewReadyHostEmailArgs = {
	clientName: string;
	editorName: string;
	sessionDate: string;
};

export type SendPackageExpiryReminderEmailArgs = {
	email: string;
	expiresAt: number;
	name: string;
	remainingSessions: number;
};

export type SendClientAssetsEmailArgs = { assetsUrl: string; name: string };

export type SendEditorAssignmentEmailArgs = {
	editorName: string;
	sessionName: string;
	sessionStartAt: number;
};

export type SendSessionDeliverablesEmailArgs = {
	date: string;
	driveLink: string;
	editorNotes?: string;
	emailVariant: DeliverablesEmailVariant;
	name: string;
};

function signoffName() {
	return BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;
}

export function renderSessionHostDetailsEmailHtml(args: SendSessionHostDetailsEmailArgs) {
	const addonsLine = formatAddonsLine({ addons: args.addons, ...pickBookingAddonQuantities(args) });

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

	return tryPromise({
		try: () => render(emailElement),
		catch: (cause) => {
			console.error("Session host details email render failed", {
				invoiceNumber: args.invoiceNumber,
				cause
			});

			return { reason: "EMAIL_RENDER_FAILED" as const };
		}
	});
}

export function renderPackageHostDetailsEmailHtml(args: SendPackageHostDetailsEmailArgs) {
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
						...pickBookingAddonQuantities(args)
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
	});
}

export function renderDeliverablesReviewReadyHostEmailHtml(
	args: SendDeliverablesReviewReadyHostEmailArgs
) {
	const sessionDateLabel = formatSessionDateLong(args.sessionDate);

	return tryPromise({
		try: () =>
			render(
				createElement(DeliverablesReviewReadyEmail, {
					clientName: args.clientName,
					editorName: args.editorName,
					sessionDateLabel
				})
			),
		catch: (cause) => {
			console.error("Deliverables review ready host email render failed", {
				clientName: args.clientName,
				cause
			});

			return { reason: "EMAIL_RENDER_FAILED" as const };
		}
	});
}

export function renderBookingRescheduledCustomerEmailHtml(
	args: SendBookingRescheduledCustomerEmailArgs
) {
	const addonsLine = formatAddonsLine({ addons: args.addons, ...pickBookingAddonQuantities(args) });

	return tryPromise({
		try: () =>
			render(
				createElement(RescheduledBookingEmail, {
					addonsLine,
					bookingDate: formatSessionDateLong(args.date),
					bookingTime: formatBookingTimeRange(args.time, args.duration),
					duration: args.duration,
					name: args.name,
					originalBookingDate: formatSessionDateLong(args.originalDate),
					originalBookingTime: formatBookingTimeRange(args.originalTime, args.duration),
					rescheduleUrl: args.rescheduleUrl,
					service: args.service,
					signoffName: signoffName()
				})
			),
		catch: (cause) => {
			console.error("Booking reschedule customer email render failed", {
				bookingEmail: args.email,
				cause
			});

			return { reason: "EMAIL_RENDER_FAILED" as const };
		}
	});
}

export function renderPackageExpiryReminderEmailHtml(args: SendPackageExpiryReminderEmailArgs) {
	return tryPromise({
		try: () =>
			render(
				createElement(PackageExpiryReminderEmail, {
					expiresAtLabel: formatTimestampDateLong(args.expiresAt),
					name: args.name,
					remainingSessions: args.remainingSessions,
					signoffName: signoffName()
				})
			),
		catch: (cause) => {
			console.error("Package expiry reminder email render failed", { email: args.email, cause });

			return { reason: "EMAIL_RENDER_FAILED" as const };
		}
	});
}

export function renderSessionReminderEmailHtml({
	name,
	email,
	date: _date,
	startDateTime,
	time,
	timeZone,
	service,
	duration,
	addons,
	isPackageSession,
	rescheduleUrl,
	...addonQuantities
}: SendBookingReminderEmailForBookingArgs) {
	const addonsLine = formatAddonsLine({ addons, ...pickBookingAddonQuantities(addonQuantities) });
	const bookingDate = formatCalendarEventDate(startDateTime, timeZone);
	const bookingTime = formatBookingTimeRange(time, duration);

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
					signoffName: signoffName()
				})
			),
		catch: (cause) => {
			console.error("Session reminder email render failed", { email, cause });

			return { reason: "EMAIL_RENDER_FAILED" as const };
		}
	});
}

export function renderClientAssetsEmailHtml(args: SendClientAssetsEmailArgs) {
	return tryPromise({
		try: () =>
			render(
				createElement(ClientAssetsEmail, {
					assetsUrl: args.assetsUrl,
					name: args.name,
					signoffName: signoffName()
				})
			),
		catch: (_cause) => ({ reason: "EMAIL_RENDER_FAILED" as const })
	});
}

export function renderEditorAssignmentEmailHtml(args: SendEditorAssignmentEmailArgs) {
	const sessionDate = formatTimestampDateLong(args.sessionStartAt);
	const dueDateLabel = formatTimestampDateLong(getEditorEditDueAt(args.sessionStartAt));

	return tryPromise({
		try: () =>
			render(
				createElement(EditorAssignmentEmail, {
					clientName: args.sessionName,
					deliverablesFolderName: formatDriveSessionMediaFolderName(
						"Deliverables",
						args.sessionStartAt
					),
					dueDateLabel,
					editorName: args.editorName,
					rawMediaFolderName: formatDriveSessionMediaFolderName("Raw Media", args.sessionStartAt),
					sessionDateLabel: sessionDate,
					signoffName: signoffName()
				})
			),
		catch: (_cause) => ({ reason: "EMAIL_RENDER_FAILED" as const })
	});
}

export function renderSessionDeliverablesEmailHtml(args: SendSessionDeliverablesEmailArgs) {
	return tryPromise({
		try: () =>
			render(
				createElement(DeliverablesEmail, {
					bookingDate: formatSessionDateWithoutYear(args.date),
					driveLink: args.driveLink,
					editorNotes: args.editorNotes?.trim() || undefined,
					emailVariant: args.emailVariant,
					name: args.name,
					signoffName: signoffName()
				})
			),
		catch: (_cause) => ({ reason: "EMAIL_RENDER_FAILED" as const })
	});
}

export function sessionHostDetailsEmailSubject(args: SendSessionHostDetailsEmailArgs) {
	const subjectPrefix = args.reschedule ? "Studio Booking Rescheduled" : "New Studio Booking";

	return `${subjectPrefix} - ${args.name} - ${formatSessionDateShort(args.date)}`;
}

export function packageHostDetailsEmailSubject(args: SendPackageHostDetailsEmailArgs) {
	return `New Package Booking Request - ${args.name} - ${args.packageSize} Pack`;
}

export function deliverablesReviewReadyHostEmailSubject(
	args: SendDeliverablesReviewReadyHostEmailArgs & { sessionDate: string }
) {
	return `Deliverables ready for review - ${args.clientName} - ${formatSessionDateShort(args.sessionDate)}`;
}

export function bookingRescheduledCustomerEmailSubject(args: { date: string }) {
	return `Your Studio Booking Has Been Rescheduled - ${formatSessionDateShort(args.date)}`;
}

export function packageExpiryReminderEmailSubject(args: { expiresAt: number }) {
	return `Reminder: Schedule Your Remaining Package Sessions — Expires ${formatTimestampDateShort(args.expiresAt)}`;
}

export function sessionReminderEmailSubject(args: { date: string }) {
	return `Reminder: Your Studio Session Tomorrow - ${formatSessionDateShort(args.date)}`;
}
