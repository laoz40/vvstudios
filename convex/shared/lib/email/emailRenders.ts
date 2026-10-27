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
import { SessionNotesEmail } from "#studio/features/session-notes-email/SessionNotesEmail";
import type { DeliverablesEmailVariant } from "#studio/features/deliverables-email/lib/constants";
import { formatBookingTimeRange } from "#studio/lib/bookingdatetime";
import { formatDriveSessionMediaFolderName, getEditorEditDueAt } from "#studio/lib/bookingdatetime";
import type { BookingAddonQuantitiesArgs } from "#convex/booking/lib/addonQuantities";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";
import { type BookingAddon } from "#/domain/booking/catalog";
import {
	formatSessionDateLong,
	formatSessionDateShort,
	formatSessionDateWithoutYear,
	formatCalendarEventDate
} from "#convex/sessions/lib/calendarTime";
import {
	formatAddonsLine,
	formatTimestampDateLong,
	formatTimestampDateShort
} from "#convex/shared/lib/email/emailSend";
import { okAsync } from "neverthrow";
import { tryPromise } from "#convex/shared/lib/result";
import { logError } from "#convex/shared/lib/logger";
import type { Id } from "#convex/_generated/dataModel";

export function renderSessionNotesEmailHtml(args: {
	kind: "admin" | "editor";
	clientName: string;
	sessionDate: string;
	notes: string;
	idempotencyKey: string;
}) {
	return tryPromise({
		try: () =>
			render(
				createElement(SessionNotesEmail, {
					kind: args.kind,
					clientName: args.clientName,
					sessionDateLabel: formatSessionDateLong(args.sessionDate),
					notes: args.notes
				})
			),
		catch: (cause) => {
			const failure = { reason: "EMAIL_RENDER_FAILED" } as const;
			logError(
				{
					...failure,
					operation: "email.renderSessionNotes",
					kind: args.kind,
					notificationKey: args.idempotencyKey
				},
				cause
			);

			return failure;
		}
	});
}

type SendBookingReminderEmailForBookingArgs = {
	bookingId: Id<"bookings">;
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
	bookingId: Id<"bookings">;
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
	bookingId: Id<"bookings">;
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
	packageId: Id<"packages">;
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
	deliverablesFolderUrl?: string;
	editorName: string;
	idempotencyKey?: string;
	sessionDate: string;
};

export type SendPackageExpiryReminderEmailArgs = {
	packageId: Id<"packages">;
	email: string;
	expiresAt: number;
	name: string;
	remainingSessions: number;
};

export type SendClientAssetsEmailArgs = {
	bookingId: Id<"bookings">;
	assetsUrl: string;
	name: string;
};

export type SendEditorAssignmentEmailArgs = {
	bookingId: Id<"bookings">;
	editorName: string;
	sessionName: string;
	sessionStartAt: number;
	editorDueDate?: string;
};

export type SendSessionDeliverablesEmailArgs = {
	bookingId: Id<"bookings">;
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
			const failure = { reason: "EMAIL_RENDER_FAILED" } as const;
			logError(
				{
					...failure,
					operation: "email.renderSessionHostDetails",
					bookingId: args.bookingId,
					invoiceNumber: args.invoiceNumber
				},
				cause
			);

			return failure;
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
			const failure = { reason: "EMAIL_RENDER_FAILED" } as const;
			logError(
				{
					...failure,
					operation: "email.renderPackageHostDetails",
					packageId: args.packageId,
					invoiceNumber: args.invoiceNumber
				},
				cause
			);

			return failure;
		}
	});
}

export function renderDeliverablesReviewReadyHostEmailHtml(
	args: SendDeliverablesReviewReadyHostEmailArgs,
	recipients: string[]
) {
	if (recipients.length === 0) {
		return okAsync(null);
	}

	const sessionDateLabel = formatSessionDateLong(args.sessionDate);

	return tryPromise({
		try: () =>
			render(
				createElement(DeliverablesReviewReadyEmail, {
					clientName: args.clientName,
					deliverablesFolderUrl: args.deliverablesFolderUrl,
					editorName: args.editorName,
					sessionDateLabel
				})
			).then((html) => ({ html, recipients })),
		catch: (cause) => {
			const failure = { reason: "EMAIL_RENDER_FAILED" } as const;
			logError(
				{
					...failure,
					operation: "email.renderDeliverablesReviewReady",
					notificationKey: args.idempotencyKey,
					clientName: args.clientName
				},
				cause
			);

			return failure;
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
			const failure = { reason: "EMAIL_RENDER_FAILED" } as const;
			logError(
				{
					...failure,
					operation: "email.renderBookingRescheduledCustomer",
					bookingId: args.bookingId
				},
				cause
			);

			return failure;
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
			const failure = { reason: "EMAIL_RENDER_FAILED" } as const;
			logError(
				{ ...failure, operation: "email.renderPackageExpiryReminder", packageId: args.packageId },
				cause
			);

			return failure;
		}
	});
}

export function renderSessionReminderEmailHtml(args: SendBookingReminderEmailForBookingArgs) {
	const {
		name,
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
	} = args;

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
			const failure = { reason: "EMAIL_RENDER_FAILED" } as const;
			logError(
				{ ...failure, operation: "email.renderSessionReminder", bookingId: args.bookingId },
				cause
			);

			return failure;
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
		catch: (cause) => {
			const failure = { reason: "EMAIL_RENDER_FAILED" } as const;
			logError(
				{ ...failure, operation: "email.renderClientAssets", bookingId: args.bookingId },
				cause
			);

			return failure;
		}
	});
}

export function renderEditorAssignmentEmailHtml(args: SendEditorAssignmentEmailArgs) {
	const sessionDate = formatTimestampDateLong(args.sessionStartAt);

	const dueDateLabel = formatTimestampDateLong(
		getEditorEditDueAt(args.sessionStartAt, args.editorDueDate)
	);

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
		catch: (cause) => {
			const failure = { reason: "EMAIL_RENDER_FAILED" } as const;
			logError(
				{ ...failure, operation: "email.renderEditorAssignment", bookingId: args.bookingId },
				cause
			);

			return failure;
		}
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
		catch: (cause) => {
			const failure = { reason: "EMAIL_RENDER_FAILED" } as const;
			logError(
				{ ...failure, operation: "email.renderSessionDeliverables", bookingId: args.bookingId },
				cause
			);

			return failure;
		}
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
