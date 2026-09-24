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
import { SessionArchiveDialog } from "#studio/features/admin/components/SessionArchiveDialog";
import { SessionCancelBookingDialog } from "#studio/features/admin/components/SessionCancelBookingDialog";
import { AdminEditConfirmationDialog } from "#studio/features/admin/components/AdminEditConfirmationDialog";
import { SessionEditDialog } from "#studio/features/admin/components/SessionEditDialog";
import { SessionAdminNotesDialog } from "#studio/features/admin/components/SessionAdminNotesDialog";
import { LegacyCustomInvoicesDialog } from "#studio/features/admin/components/LegacyCustomInvoicesDialog";
import { StripeBillingDialog } from "#studio/features/admin/components/StripeBillingDialog";
import { StripeInvoiceDialog } from "#studio/features/admin/components/StripeInvoiceDialog";
import { DeliverablesEmailDialog } from "#studio/features/admin/components/DeliverablesEmailDialog";
import type { SessionActionDetails } from "#studio/features/admin/lib/admin-sessions";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import { createStripeInvoiceContext } from "#studio/features/admin/lib/stripe-invoice-pricing";
import type { useSessionArchiveAndCancelActions } from "#studio/features/admin/hooks/useSessionArchiveAndCancelActions";
import type { useDeliverablesEmailAction } from "#studio/features/admin/hooks/useDeliverablesEmailAction";
import type { useEditAction } from "#studio/features/admin/hooks/useEditAction";
import type { useInvoiceActions } from "#studio/features/admin/hooks/useInvoiceActions";
import type { usePackageInvoiceActions } from "#studio/features/admin/hooks/usePackageInvoiceActions";
import type { useRescheduleAction } from "#studio/features/admin/hooks/useRescheduleAction";

type SessionActionsDialogsProps = {
	session: SessionRecord;
	details: SessionActionDetails;
	archiveAndCancelAction: ReturnType<typeof useSessionArchiveAndCancelActions>;
	deliverablesEmailAction: ReturnType<typeof useDeliverablesEmailAction>;
	editAction: ReturnType<typeof useEditAction>;
	invoiceActions: ReturnType<typeof useInvoiceActions>;
	packageInvoiceActions: ReturnType<typeof usePackageInvoiceActions>;
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

function SessionArchiveDialogHost({
	session,
	customerSessionId,
	archiveAndCancelAction
}: {
	session: SessionRecord;
	customerSessionId: string;
	archiveAndCancelAction: ReturnType<typeof useSessionArchiveAndCancelActions>;
}) {
	return (
		<SessionArchiveDialog
			open={archiveAndCancelAction.isArchiveDialogOpen}
			bookingName={session.name}
			bookingId={customerSessionId}
			sessionDate={session.date}
			sessionTime={session.time}
			editorDisplayName={session.assignedEditorDisplayName ?? null}
			onOpenChange={archiveAndCancelAction.setIsArchiveDialogOpen}
			onConfirm={archiveAndCancelAction.confirmArchiveFromInbox}
			isArchiving={archiveAndCancelAction.isUpdatingArchive}
		/>
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
	archiveAndCancelAction,
	deliverablesEmailAction,
	editAction,
	invoiceActions,
	packageInvoiceActions,
	rescheduleAction,
	isAdminNotesDialogOpen,
	onAdminNotesDialogOpenChange
}: SessionActionsDialogsProps) {
	const stripeInvoiceContext = createStripeInvoiceContext(session.duration);

	const packageStripeInvoiceContext =
		session.packageId && session.linkedPackageSize
			? createStripeInvoiceContext(session.duration, session.linkedPackageSize)
			: null;

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

			<LegacyCustomInvoicesDialog
				open={invoiceActions.isLegacyCustomInvoicesDialogOpen}
				customerEmail={session.email}
				customerName={session.name}
				downloadingInvoiceId={invoiceActions.downloadingLegacyCustomInvoiceId}
				invoices={invoiceActions.legacyCustomInvoices}
				onDownload={(customInvoiceId) => {
					void invoiceActions.handleDownloadLegacyCustomInvoice(customInvoiceId);
				}}
				onOpenChange={invoiceActions.setIsLegacyCustomInvoicesDialogOpen}
			/>

			<StripeBillingDialog
				open={invoiceActions.isStripeBillingDialogOpen}
				customerEmail={session.email}
				customerName={session.name}
				invoices={invoiceActions.stripeBillingInvoices}
				onOpenChange={invoiceActions.setIsStripeBillingDialogOpen}
			/>

			{invoiceActions.hasStripeCustomer && stripeInvoiceContext ? (
				<StripeInvoiceDialog
					open={invoiceActions.isStripeInvoiceDialogOpen}
					customerEmail={session.email}
					customerName={session.name}
					hasStripeCustomer
					invoiceContext={stripeInvoiceContext}
					isSending={invoiceActions.isSendingStripeInvoice}
					onOpenChange={invoiceActions.setIsStripeInvoiceDialogOpen}
					onSend={invoiceActions.handleSendStripeInvoice}
				/>
			) : null}

			{packageInvoiceActions.hasStripeCustomer && packageStripeInvoiceContext ? (
				<StripeInvoiceDialog
					open={packageInvoiceActions.isStripeInvoiceDialogOpen}
					customerEmail={session.email}
					customerName={session.name}
					hasStripeCustomer
					invoiceContext={packageStripeInvoiceContext}
					isSending={packageInvoiceActions.isSendingStripeInvoice}
					onOpenChange={packageInvoiceActions.setIsStripeInvoiceDialogOpen}
					onSend={packageInvoiceActions.handleSendStripeInvoice}
				/>
			) : null}

			<SessionArchiveDialogHost
				session={session}
				customerSessionId={details.customerSessionId}
				archiveAndCancelAction={archiveAndCancelAction}
			/>

			<SessionCancelBookingDialog
				open={archiveAndCancelAction.isCancelBookingDialogOpen}
				bookingName={session.name}
				bookingId={details.customerSessionId}
				sessionDate={session.date}
				sessionTime={session.time}
				onOpenChange={archiveAndCancelAction.setIsCancelBookingDialogOpen}
				onConfirm={archiveAndCancelAction.handleCancelBooking}
				isCancelling={archiveAndCancelAction.isCancellingBooking}
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
						? "Check what will change. Your manual balance due will be used, not the recalculated amount."
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
