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
import { SessionDeleteDialog } from "#studio/features/admin/components/SessionDeleteDialog";
import { AdminEditConfirmationDialog } from "#studio/features/admin/components/AdminEditConfirmationDialog";
import { SessionEditDialog } from "#studio/features/admin/components/SessionEditDialog";
import { SessionAdminNotesDialog } from "#studio/features/admin/components/SessionAdminNotesDialog";
import { CustomInvoiceDialog } from "#studio/features/admin/components/CustomInvoiceDialog";
import { DeliverablesEmailDialog } from "#studio/features/admin/components/DeliverablesEmailDialog";
import { EmailInvoiceDialog } from "#studio/features/admin/components/EmailInvoiceDialog";
import type { SessionActionDetails } from "#studio/features/admin/lib/admin-sessions";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import type { useDeleteAction } from "#studio/features/admin/hooks/useDeleteAction";
import type { useDeliverablesEmailAction } from "#studio/features/admin/hooks/useDeliverablesEmailAction";
import type { useEditAction } from "#studio/features/admin/hooks/useEditAction";
import type { useInvoiceActions } from "#studio/features/admin/hooks/useInvoiceActions";
import type { useRescheduleAction } from "#studio/features/admin/hooks/useRescheduleAction";

type SessionActionsDialogsProps = {
	session: SessionRecord;
	details: SessionActionDetails;
	deleteAction: ReturnType<typeof useDeleteAction>;
	deliverablesEmailAction: ReturnType<typeof useDeliverablesEmailAction>;
	editAction: ReturnType<typeof useEditAction>;
	invoiceActions: ReturnType<typeof useInvoiceActions>;
	rescheduleAction: ReturnType<typeof useRescheduleAction>;
	isAdminNotesDialogOpen: boolean;
	onAdminNotesDialogOpenChange: (open: boolean) => void;
};

function RescheduleLinkDialog({
	sessionName,
	rescheduleAction
}: {
	sessionName: string;
	rescheduleAction: ReturnType<typeof useRescheduleAction>;
}) {
	const generatedUrl = rescheduleAction.generatedRescheduleUrl;
	const isGenerating = rescheduleAction.isGeneratingRescheduleLink;

	return (
		<Dialog
			open={rescheduleAction.isRescheduleLinkDialogOpen}
			onOpenChange={rescheduleAction.setIsRescheduleLinkDialogOpen}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Generate reschedule link?</DialogTitle>
					<DialogDescription>
						This will create a new reschedule link for {sessionName}. Any existing active reschedule
						link they have will stop working.
					</DialogDescription>
				</DialogHeader>
				{generatedUrl ? (
					<div className="flex flex-col gap-2 rounded-md bg-muted p-3 text-sm">
						<span className="font-medium">New reschedule link</span>
						<a
							href={generatedUrl}
							target="_blank"
							rel="noreferrer"
							className="break-all text-muted-foreground underline underline-offset-4">
							{generatedUrl}
						</a>
					</div>
				) : null}
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => rescheduleAction.setIsRescheduleLinkDialogOpen(false)}>
						{generatedUrl ? "Close" : "Cancel"}
					</Button>
					{generatedUrl ? (
						<Button
							type="button"
							onClick={rescheduleAction.copyRescheduleLink}>
							Copy link
						</Button>
					) : (
						<Button
							type="button"
							disabled={isGenerating}
							onClick={() => {
								void rescheduleAction.handleGenerateRescheduleLink();
							}}>
							{isGenerating ? <LoaderCircle className="size-4 animate-spin" /> : null}
							{isGenerating ? "Generating..." : "Generate link"}
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ReplacementEventDialog({ editAction }: { editAction: ReturnType<typeof useEditAction> }) {
	return (
		<Dialog
			open={editAction.isReplacementEventDialogOpen}
			onOpenChange={editAction.setIsReplacementEventDialogOpen}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Google Calendar event repaired</DialogTitle>
					<DialogDescription>
						The old Google Calendar event was missing or deleted, so a replacement event was created
						and linked to this session.
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
	);
}

export function SessionActionsDialogs({
	session,
	details,
	deleteAction,
	deliverablesEmailAction,
	editAction,
	invoiceActions,
	rescheduleAction,
	isAdminNotesDialogOpen,
	onAdminNotesDialogOpenChange
}: SessionActionsDialogsProps) {
	return (
		<>
			<SessionAdminNotesDialog
				bookingId={session._id}
				bookingName={session.name}
				savedNotes={session.adminNotes}
				open={isAdminNotesDialogOpen}
				onOpenChange={onAdminNotesDialogOpenChange}
			/>

			<RescheduleLinkDialog
				sessionName={session.name}
				rescheduleAction={rescheduleAction}
			/>

			<EmailInvoiceDialog
				open={invoiceActions.isEmailInvoiceDialogOpen}
				bookingName={session.name}
				bookingEmail={session.email}
				customInvoices={invoiceActions.customInvoices}
				isSending={invoiceActions.isEmailingInvoice}
				selectedCustomInvoiceId={invoiceActions.selectedEmailCustomInvoiceId}
				onOpenChange={invoiceActions.setIsEmailInvoiceDialogOpen}
				onSelectedCustomInvoiceIdChange={invoiceActions.setSelectedEmailCustomInvoiceId}
				onSend={() => {
					void invoiceActions.handleEmailInvoice();
				}}
			/>

			<DeliverablesEmailDialog
				open={deliverablesEmailAction.isDeliverablesEmailDialogOpen}
				recipient={{ visibility: "shown", email: session.email }}
				bookingId={session._id}
				bookingName={session.name}
				deliverablesFolderName={deliverablesEmailAction.deliverablesFolderName}
				deliverablesFolderUrl={deliverablesEmailAction.deliverablesFolderUrl}
				editorNotes={deliverablesEmailAction.deliverablesEditorNotesDraft}
				isFolderStatusLoading={deliverablesEmailAction.isFolderStatusLoading}
				isSending={deliverablesEmailAction.isEmailingDeliverables}
				markAsSentAfterSending={deliverablesEmailAction.markDeliverablesAsSentAfterSending}
				onEditorNotesChange={deliverablesEmailAction.setDeliverablesEditorNotesDraft}
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
				session={session}
				onOpenChange={invoiceActions.setIsCustomInvoiceDialogOpen}
			/>

			<SessionDeleteDialog
				open={deleteAction.isDeleteDialogOpen}
				bookingName={session.name}
				bookingId={details.customerSessionId}
				sessionDate={session.date}
				sessionTime={session.time}
				onOpenChange={deleteAction.setIsDeleteDialogOpen}
				onConfirm={deleteAction.handleDeleteBooking}
				isDeleting={deleteAction.isDeleting}
			/>
			<SessionEditDialog
				open={editAction.isEditDialogOpen}
				session={session}
				bookingId={details.customerSessionId}
				onOpenChange={editAction.setIsEditDialogOpen}
				onSave={editAction.handleEditBooking}
				isSaving={editAction.isSaving}
			/>

			<AdminEditConfirmationDialog
				open={editAction.isEditConfirmationDialogOpen}
				isSaving={editAction.isSaving}
				googleEventFieldLabels={editAction.pendingEditWarningState?.googleEventFieldLabels ?? []}
				driveIdentityFieldLabels={
					editAction.pendingEditWarningState?.driveIdentityFieldLabels ?? []
				}
				description={
					editAction.pendingEditWarningState?.manualPriceWillBeUsed
						? "Review what this save will affect before making the session changes permanent. The manual remaining balance due will be used instead of the recalculated default."
						: undefined
				}
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

			<ReplacementEventDialog editAction={editAction} />
		</>
	);
}
