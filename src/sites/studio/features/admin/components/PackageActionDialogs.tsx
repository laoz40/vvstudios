import { AdminEditConfirmationDialog } from "#studio/features/admin/components/AdminEditConfirmationDialog";
import { PackageCustomInvoiceDialog } from "#studio/features/admin/components/PackageCustomInvoiceDialog";
import { PackageEditDialog } from "#studio/features/admin/components/PackageEditDialog";
import { PackageEmailConfirmationDialog } from "#studio/features/admin/components/PackageEmailConfirmationDialog";
import { PackagePaymentConfirmationDialog } from "#studio/features/admin/components/PackagePaymentConfirmationDialog";
import type { usePackageActions } from "#studio/features/admin/hooks/usePackageActions";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";

type PackageActionDialogsProps = {
	actions: ReturnType<typeof usePackageActions>;
	packageRow: AdminPackageRow;
};

export function PackageActionDialogs({ actions, packageRow }: PackageActionDialogsProps) {
	const { editAction, pendingAction } = actions;

	return (
		<>
			<PackageEditDialog
				open={editAction.isEditDialogOpen}
				packageRow={packageRow}
				onOpenChange={editAction.setIsEditDialogOpen}
				onSave={editAction.handleEditPackage}
				isSaving={editAction.isSaving}
			/>
			<PackageCustomInvoiceDialog
				open={actions.isCustomInvoiceDialogOpen}
				packageRow={packageRow}
				onOpenChange={actions.setIsCustomInvoiceDialogOpen}
			/>
			<AdminEditConfirmationDialog
				open={editAction.isEditConfirmationDialogOpen}
				isSaving={editAction.isSaving}
				googleEventFieldLabels={editAction.pendingEditWarningState?.changedFieldLabels ?? []}
				nonPricingTitle="Package info will update"
				pricingTitle="Pricing may recalculate"
				description={
					editAction.pendingEditWarningState?.manualPriceWillBeUsed
						? "Review what this save will affect before making the package changes permanent. The manual package total due will be used instead of the recalculated default."
						: "Review what this save will affect before making the package changes permanent."
				}
				onCancel={editAction.closeEditConfirmationDialog}
				pricingFieldLabels={editAction.pendingEditWarningState?.pricingFieldLabels ?? []}
				onConfirm={() => {
					void editAction.handleConfirmEditPackage();
				}}
				onOpenChange={(nextOpen) => {
					editAction.setIsEditConfirmationDialogOpen(nextOpen);
					if (!nextOpen) {
						editAction.closeEditConfirmationDialog();
					}
				}}
			/>
			<PackagePaymentConfirmationDialog
				open={actions.isPaymentDialogOpen}
				onOpenChange={actions.setIsPaymentDialogOpen}
				packageRow={packageRow}
				isConfirming={pendingAction === "payment"}
				onConfirm={() => void actions.handleConfirmPayment()}
			/>
			<PackageEmailConfirmationDialog
				open={actions.isInvoiceDialogOpen}
				customerName={packageRow.customerName}
				customerEmail={packageRow.customerEmail}
				description="Confirm before sending the package invoice email to this customer."
				isSending={pendingAction === "invoice"}
				sendLabel="Email invoice"
				sendingLabel="Sending invoice..."
				title="Email package invoice to customer?"
				onOpenChange={actions.setIsInvoiceDialogOpen}
				onSend={() => void actions.handleResendInvoice()}
			/>
			<PackageEmailConfirmationDialog
				open={actions.isAdjustmentInvoiceDialogOpen}
				customerName={packageRow.customerName}
				customerEmail={packageRow.customerEmail}
				description="Retry the failed adjustment invoice email without creating a new invoice."
				isSending={pendingAction === "adjustmentEmail"}
				sendLabel="Retry invoice"
				sendingLabel="Sending invoice"
				title="Retry adjustment invoice email?"
				onOpenChange={actions.setIsAdjustmentInvoiceDialogOpen}
				onSend={() => void actions.handleRetryAdjustmentInvoice()}
			/>
			<PackageEmailConfirmationDialog
				open={actions.isSchedulingLinkDialogOpen}
				customerName={packageRow.customerName}
				customerEmail={packageRow.customerEmail}
				description="This will create a fresh scheduling link for this package. Any previous scheduling link will stop working."
				isSending={pendingAction === "scheduleEmail"}
				sendLabel="Send New Scheduling Link"
				sendingLabel="Sending scheduling link..."
				title="Send new scheduling link to customer?"
				onOpenChange={actions.setIsSchedulingLinkDialogOpen}
				onSend={() => void actions.handleRetrySchedulingEmail()}
			/>
		</>
	);
}
