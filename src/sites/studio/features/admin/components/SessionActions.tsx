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
	type SessionActionDetails,
	type SessionRecord,
	isManageableConfirmedSession
} from "#studio/features/admin/lib/admin-sessions";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { isUpcomingBooking } from "#studio/lib/bookingdatetime";

export type SessionActionsProps = { session: SessionRecord };

export function SessionActions({ session }: SessionActionsProps) {
	const canManageConfirmedSession = isManageableConfirmedSession(session);
	const isPastSession = !isUpcomingBooking(session.date, session.time);
	const details: SessionActionDetails = {
		canGenerateRescheduleLink: getCanGenerateRescheduleLink(session, isPastSession),
		customerSessionId:
			session.multiBookingInvoiceNumber ??
			formatBookingInvoiceNumber(session._id, session.pendingPaymentCreatedAt),
		canManageConfirmedSession,
		isPastSession
	};

	const deleteAction = useDeleteAction(session);
	const deliverablesEmailAction = useDeliverablesEmailAction(session);
	const editAction = useEditAction(session);
	const invoiceActions = useInvoiceActions(session);
	const paymentActions = usePaymentActions(session);
	const rescheduleAction = useRescheduleAction(session);
	const statusActions = useStatusActions(session);

	return (
		<>
			<SessionActionsMenu
				session={session}
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
				session={session}
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

function getCanGenerateRescheduleLink(session: SessionRecord, isPastSession: boolean) {
	return (
		!isPastSession &&
		(session.status === "confirmed" ||
			session.status === "email_failed" ||
			(session.status === "failed" &&
				(session.bookingFailureCode === "BOOKING_TIME_UNAVAILABLE" ||
					session.bookingFailureCode === "GOOGLE_CALENDAR_CREATE_FAILED")))
	);
}
