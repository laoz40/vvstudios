import { err, ok, okAsync, ResultAsync, type Result } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { createBookingInvoiceArtifactsForBooking } from "#convex/lib/bookingInvoiceArtifacts";
import { sendSessionHostDetailsEmail } from "#convex/lib/email";
import type { AdminSessionUpdateResult } from "#convex/lib/sessionAdminEdit";
import { getSessionFromQuery } from "#convex/lib/sessionLookup";

export async function sendSessionHostRescheduleEmailForBooking(
	booking: Doc<"bookings">,
	options: { leadTimeMinutes: number; originalDate: string; originalTime: string }
): Promise<Result<null, { reason: "INVALID_BOOKING_DATA" | "HOST_EMAIL_SEND_FAILED" }>> {
	const artifactsResult = createBookingInvoiceArtifactsForBooking(
		booking,
		booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt,
		{ leadTimeMinutes: options.leadTimeMinutes }
	);

	if (artifactsResult.isErr()) {
		return err(artifactsResult.error);
	}

	const { artifacts, booking: parsedBooking } = artifactsResult.value;

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
		reschedule: { originalDate: options.originalDate, originalTime: options.originalTime }
	});

	if (hostEmailResult.isErr()) {
		console.error("Session reschedule host email send failed", {
			bookingId: booking._id,
			reason: hostEmailResult.error.reason
		});

		return err({ reason: "HOST_EMAIL_SEND_FAILED" });
	}

	return ok(null);
}

export function notifyHostOfAdminSessionReschedule(
	ctx: ActionCtx,
	args: {
		bookingId: Id<"bookings">;
		leadTimeMinutes: number;
		originalDate: string;
		originalTime: string;
		result: AdminSessionUpdateResult;
	}
): ResultAsync<AdminSessionUpdateResult, { reason: "BOOKING_NOT_FOUND" }> {
	return getSessionFromQuery(ctx, args.bookingId).andThen((updatedSession) =>
		ResultAsync.fromSafePromise(
			sendSessionHostRescheduleEmailForBooking(updatedSession, {
				leadTimeMinutes: args.leadTimeMinutes,
				originalDate: args.originalDate,
				originalTime: args.originalTime
			})
		)
			.andThen((emailResult) => emailResult)
			.orElse((error) => {
				console.error("Admin session reschedule host email send failed", {
					bookingId: updatedSession._id,
					reason: error.reason
				});

				return okAsync(null);
			})
			.map(() => args.result)
	);
}
