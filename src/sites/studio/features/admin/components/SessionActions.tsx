import { SessionActionsDialogs } from "#studio/features/admin/components/SessionActionsDialogs";
import { SessionActionsMenu } from "#studio/features/admin/components/SessionActionsMenu";
import { useDeleteAction } from "#studio/features/admin/hooks/useDeleteAction";
import { useDeliverablesEmailAction } from "#studio/features/admin/hooks/useDeliverablesEmailAction";
import { useEditAction } from "#studio/features/admin/hooks/useEditAction";
import { useInvoiceActions } from "#studio/features/admin/hooks/useInvoiceActions";
import { usePaymentActions } from "#studio/features/admin/hooks/usePaymentActions";
import { useRescheduleAction } from "#studio/features/admin/hooks/useRescheduleAction";
import { useStatusActions } from "#studio/features/admin/hooks/useStatusActions";
import {
	type BookingActionDetails,
	type BookingRecord,
	isManageableConfirmedBooking
} from "#studio/features/admin/lib/admin-bookings";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { isUpcomingBooking } from "#studio/lib/bookingdatetime";

export type SessionActionsProps = { booking: BookingRecord };

export function SessionActions({ booking }: SessionActionsProps) {
	const canManageConfirmedBooking = isManageableConfirmedBooking(booking);
	const isPastBooking = !isUpcomingBooking(booking.date, booking.time);
	const details: BookingActionDetails = {
		canGenerateRescheduleLink: getCanGenerateRescheduleLink(booking, isPastBooking),
		customerBookingId:
			booking.multiBookingInvoiceNumber ??
			formatBookingInvoiceNumber(booking._id, booking.pendingPaymentCreatedAt),
		canManageConfirmedBooking,
		isPastBooking
	};

	const deleteAction = useDeleteAction(booking);
	const deliverablesEmailAction = useDeliverablesEmailAction(booking);
	const editAction = useEditAction(booking);
	const invoiceActions = useInvoiceActions(booking);
	const paymentActions = usePaymentActions(booking);
	const rescheduleAction = useRescheduleAction(booking);
	const statusActions = useStatusActions(booking);

	return (
		<>
			<SessionActionsMenu
				booking={booking}
				details={details}
				deleteAction={deleteAction}
				deliverablesEmailAction={deliverablesEmailAction}
				editAction={editAction}
				invoiceActions={invoiceActions}
				paymentActions={paymentActions}
				rescheduleAction={rescheduleAction}
				statusActions={statusActions}
			/>
			<SessionActionsDialogs
				booking={booking}
				details={details}
				deleteAction={deleteAction}
				deliverablesEmailAction={deliverablesEmailAction}
				editAction={editAction}
				invoiceActions={invoiceActions}
				rescheduleAction={rescheduleAction}
			/>
		</>
	);
}

function getCanGenerateRescheduleLink(booking: BookingRecord, isPastBooking: boolean) {
	return (
		!isPastBooking &&
		(booking.status === "confirmed" ||
			booking.status === "email_failed" ||
			(booking.status === "failed" &&
				(booking.bookingFailureCode === "BOOKING_TIME_UNAVAILABLE" ||
					booking.bookingFailureCode === "GOOGLE_CALENDAR_CREATE_FAILED")))
	);
}
