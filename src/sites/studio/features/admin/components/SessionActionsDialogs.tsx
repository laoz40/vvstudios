import { LoaderCircle } from "lucide-react";

import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { BookingDeleteDialog } from "#studio/features/admin/components/BookingDeleteDialog";
import { BookingEditConfirmationDialog } from "#studio/features/admin/components/BookingEditConfirmationDialog";
import { BookingEditDialog } from "#studio/features/admin/components/BookingEditDialog";
import { CustomInvoiceDialog } from "#studio/features/admin/components/CustomInvoiceDialog";
import { DeliverablesEmailDialog } from "#studio/features/admin/components/DeliverablesEmailDialog";
import { EmailInvoiceDialog } from "#studio/features/admin/components/EmailInvoiceDialog";
import { RemainingBalanceDialog } from "#studio/features/admin/components/RemainingBalanceDialog";
import type { BookingActionDetails } from "#studio/features/admin/lib/admin-bookings";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";
import type { useDeleteAction } from "#studio/features/admin/hooks/useDeleteAction";
import type { useDeliverablesEmailAction } from "#studio/features/admin/hooks/useDeliverablesEmailAction";
import type { useEditAction } from "#studio/features/admin/hooks/useEditAction";
import type { useInvoiceActions } from "#studio/features/admin/hooks/useInvoiceActions";
import type { usePaymentActions } from "#studio/features/admin/hooks/usePaymentActions";
import type { useRescheduleAction } from "#studio/features/admin/hooks/useRescheduleAction";

type SessionActionsDialogsProps = {
	booking: BookingRecord;
	details: BookingActionDetails;
	deleteAction: ReturnType<typeof useDeleteAction>;
	deliverablesEmailAction: ReturnType<typeof useDeliverablesEmailAction>;
	editAction: ReturnType<typeof useEditAction>;
	invoiceActions: ReturnType<typeof useInvoiceActions>;
	paymentActions: ReturnType<typeof usePaymentActions>;
	rescheduleAction: ReturnType<typeof useRescheduleAction>;
};

export function SessionActionsDialogs({
	booking,
	details,
	deleteAction,
	deliverablesEmailAction,
	editAction,
	invoiceActions,
	paymentActions,
	rescheduleAction
}: SessionActionsDialogsProps) {
	return (
		<>
			<Dialog
				open={rescheduleAction.isRescheduleLinkDialogOpen}
				onOpenChange={rescheduleAction.setIsRescheduleLinkDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Generate reschedule link?</DialogTitle>
						<DialogDescription>
							This will create a new reschedule link for {booking.name}. Any existing active
							reschedule link they have will stop working.
						</DialogDescription>
					</DialogHeader>
					{rescheduleAction.generatedRescheduleUrl ? (
						<div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
							<span className="font-medium">New reschedule link</span>
							<a
								href={rescheduleAction.generatedRescheduleUrl}
								target="_blank"
								rel="noreferrer"
								className="break-all text-muted-foreground underline underline-offset-4">
								{rescheduleAction.generatedRescheduleUrl}
							</a>
						</div>
					) : null}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => rescheduleAction.setIsRescheduleLinkDialogOpen(false)}>
							{rescheduleAction.generatedRescheduleUrl ? "Close" : "Cancel"}
						</Button>
						{rescheduleAction.generatedRescheduleUrl ? (
							<Button
								type="button"
								onClick={rescheduleAction.copyRescheduleLink}>
								Copy link
							</Button>
						) : (
							<Button
								type="button"
								disabled={rescheduleAction.isGeneratingRescheduleLink}
								onClick={() => {
									void rescheduleAction.handleGenerateRescheduleLink();
								}}>
								{rescheduleAction.isGeneratingRescheduleLink ? (
									<LoaderCircle className="size-4 animate-spin" />
								) : null}
								{rescheduleAction.isGeneratingRescheduleLink ? "Generating..." : "Generate link"}
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<EmailInvoiceDialog
				open={invoiceActions.isEmailInvoiceDialogOpen}
				bookingName={booking.name}
				bookingEmail={booking.email}
				isSending={invoiceActions.isEmailingInvoice}
				onOpenChange={invoiceActions.setIsEmailInvoiceDialogOpen}
				onSend={() => {
					void invoiceActions.handleEmailInvoice();
				}}
			/>

			<DeliverablesEmailDialog
				open={deliverablesEmailAction.isDeliverablesEmailDialogOpen}
				bookingEmail={booking.email}
				bookingId={booking._id}
				bookingName={booking.name}
				driveLink={deliverablesEmailAction.deliverablesDriveLinkDraft}
				editorNotes={deliverablesEmailAction.deliverablesEditorNotesDraft}
				emailVariant={deliverablesEmailAction.deliverablesEmailVariantDraft}
				isSending={deliverablesEmailAction.isEmailingDeliverables}
				markAsSentAfterSending={deliverablesEmailAction.markDeliverablesAsSentAfterSending}
				onDriveLinkChange={deliverablesEmailAction.setDeliverablesDriveLinkDraft}
				onEditorNotesChange={deliverablesEmailAction.setDeliverablesEditorNotesDraft}
				onEmailVariantChange={deliverablesEmailAction.setDeliverablesEmailVariantDraft}
				onMarkAsSentAfterSendingChange={
					deliverablesEmailAction.setMarkDeliverablesAsSentAfterSending
				}
				onOpenChange={deliverablesEmailAction.setIsDeliverablesEmailDialogOpen}
				onSend={() => {
					void deliverablesEmailAction.handleEmailDeliverables();
				}}
			/>

			<CustomInvoiceDialog
				open={invoiceActions.isCustomInvoiceDialogOpen}
				booking={booking}
				onOpenChange={invoiceActions.setIsCustomInvoiceDialogOpen}
			/>

			<RemainingBalanceDialog
				open={paymentActions.isRemainingBalanceDialogOpen}
				bookingId={booking._id}
				value={paymentActions.remainingBalanceDraft}
				defaultAmount={paymentActions.remainingBalanceAmount}
				isSaving={paymentActions.isUpdatingRemainingBalanceAmount}
				onOpenChange={paymentActions.setIsRemainingBalanceDialogOpen}
				onValueChange={paymentActions.setRemainingBalanceDraft}
				onSave={() => {
					void paymentActions.handleSetRemainingBalanceAmount();
				}}
			/>

			<BookingDeleteDialog
				open={deleteAction.isDeleteDialogOpen}
				bookingName={booking.name}
				bookingId={details.customerBookingId}
				sessionDate={booking.date}
				sessionTime={booking.time}
				onOpenChange={deleteAction.setIsDeleteDialogOpen}
				onConfirm={deleteAction.handleDeleteBooking}
				isDeleting={deleteAction.isDeleting}
			/>
			<BookingEditDialog
				open={editAction.isEditDialogOpen}
				booking={booking}
				bookingId={details.customerBookingId}
				onOpenChange={editAction.setIsEditDialogOpen}
				onSave={editAction.handleEditBooking}
				isSaving={editAction.isSaving}
			/>

			<BookingEditConfirmationDialog
				open={editAction.isEditConfirmationDialogOpen}
				isSaving={editAction.isSaving}
				googleEventFieldLabels={editAction.pendingEditWarningState?.googleEventFieldLabels ?? []}
				onCancel={editAction.closeEditConfirmationDialog}
				pricingFieldLabels={editAction.pendingEditWarningState?.pricingFieldLabels ?? []}
				onConfirm={() => {
					void editAction.handleConfirmEditBooking();
				}}
				onOpenChange={(nextOpen) => {
					editAction.setIsEditConfirmationDialogOpen(nextOpen);
					if (!nextOpen) {
						editAction.closeEditConfirmationDialog();
					}
				}}
			/>

			<Dialog
				open={editAction.isReplacementEventDialogOpen}
				onOpenChange={editAction.setIsReplacementEventDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Google Calendar event repaired</DialogTitle>
						<DialogDescription>
							The old Google Calendar event was missing or deleted, so a replacement event was
							created and linked to this booking.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							type="button"
							onClick={() => editAction.setIsReplacementEventDialogOpen(false)}>
							OK
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
