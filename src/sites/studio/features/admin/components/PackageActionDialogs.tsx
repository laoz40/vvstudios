import { AdminEditConfirmationDialog } from "#studio/features/admin/components/AdminEditConfirmationDialog";
import { PackageEditDialog } from "#studio/features/admin/components/PackageEditDialog";
import { PackageEmailConfirmationDialog } from "#studio/features/admin/components/PackageEmailConfirmationDialog";
import { LegacyCustomInvoicesDialog } from "#studio/features/admin/components/LegacyCustomInvoicesDialog";
import { StripeBillingDialog } from "#studio/features/admin/components/StripeBillingDialog";
import { StripeInvoiceDialog } from "#studio/features/admin/components/StripeInvoiceDialog";
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
			<LegacyCustomInvoicesDialog
				open={actions.isLegacyCustomInvoicesDialogOpen}
				customerEmail={packageRow.customerEmail}
				customerName={packageRow.customerName}
				downloadingInvoiceId={actions.downloadingLegacyCustomInvoiceId}
				invoices={actions.legacyCustomInvoices}
				onDownload={(customInvoiceId) => {
					void actions.handleDownloadLegacyCustomInvoice(customInvoiceId);
				}}
				onOpenChange={actions.setIsLegacyCustomInvoicesDialogOpen}
			/>

			<StripeBillingDialog
				open={actions.isStripeBillingDialogOpen}
				customerEmail={packageRow.customerEmail}
				customerName={packageRow.customerName}
				invoices={actions.stripeBillingInvoices}
				onOpenChange={actions.setIsStripeBillingDialogOpen}
			/>

			{actions.hasStripeCustomer ? (
				<StripeInvoiceDialog
					open={actions.isStripeInvoiceDialogOpen}
					customerEmail={packageRow.customerEmail}
					customerName={packageRow.customerName}
					hasStripeCustomer
					isSending={actions.isSendingStripeInvoice}
					onOpenChange={actions.setIsStripeInvoiceDialogOpen}
					onSend={actions.handleSendStripeInvoice}
				/>
			) : null}
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
				open={actions.isPackageEmailDialogOpen}
				customerName={packageRow.customerName}
				customerEmail={packageRow.customerEmail}
				description="This will email the receipt and a fresh scheduling link. Any previous scheduling link will stop working."
				isSending={pendingAction === "packageEmail"}
				sendLabel="Resend package email"
				sendingLabel="Sending package email"
				title="Resend package email to customer?"
				onOpenChange={actions.setIsPackageEmailDialogOpen}
				onSend={() => void actions.handleResendPackageEmail()}
			/>
		</>
	);
}
