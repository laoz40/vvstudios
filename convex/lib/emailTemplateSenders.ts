import { createElement } from "react";
import { render } from "@react-email/render";
import type { Id } from "#convex/_generated/dataModel";
import { BOOKING_INVOICE_BUSINESS } from "#studio/features/booking-invoice/lib/constants";
import { ClientAssetsEmail } from "#studio/features/client-assets-email/ClientAssetsEmail";
import { DeliverablesEmail } from "#studio/features/deliverables-email/DeliverablesEmail";
import { EditorAssignmentEmail } from "#studio/features/editor-assignment-email/EditorAssignmentEmail";
import type { DeliverablesEmailVariant } from "#studio/features/deliverables-email/lib/constants";
import { formatDriveSessionMediaFolderName, getEditorEditDueAt } from "#studio/lib/bookingdatetime";
import {
	formatSessionDateShort,
	formatSessionDateWithoutYear
} from "#convex/lib/sessionCalendarTime";
import { formatTimestampDateLong, sendEmail } from "#convex/lib/emailSend";
import { tryPromise } from "#convex/lib/result";

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

export function sendClientAssetsEmail({
	assetsUrl,
	bookingId,
	email,
	name
}: SendClientAssetsEmailArgs) {
	const signoffName =
		BOOKING_INVOICE_BUSINESS.ownerName.split(" ")[0] ?? BOOKING_INVOICE_BUSINESS.ownerName;

	return tryPromise({
		try: () => render(createElement(ClientAssetsEmail, { assetsUrl, name, signoffName })),
		catch: (cause) => {
			console.error("Client assets email render failed", { bookingId, cause });

			return { reason: "EMAIL_RENDER_FAILED" as const };
		}
	}).andThen((html) =>
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

	return tryPromise({
		try: () =>
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
			),
		catch: (cause) => {
			console.error("Editor assignment email render failed", { sessionStartAt, cause });

			return { reason: "EMAIL_RENDER_FAILED" as const };
		}
	}).andThen((html) =>
		sendEmail({
			to: [editorEmail],
			subject: `New editing job assigned: ${sessionName}, ${sessionDate}`,
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

	return tryPromise({
		try: () =>
			render(
				createElement(DeliverablesEmail, {
					bookingDate: formatSessionDateWithoutYear(date),
					driveLink,
					editorNotes: editorNotes?.trim() || undefined,
					emailVariant,
					name,
					signoffName
				})
			),
		catch: (cause) => {
			console.error("Session deliverables email render failed", { emailVariant, cause });

			return { reason: "EMAIL_RENDER_FAILED" as const };
		}
	}).andThen((html) =>
		sendEmail({
			to: [email],
			subject: `Your VV Studios Deliverables Folder - ${formatSessionDateShort(date)}`,
			html
		})
	);
}
