import { useRef } from "react";
import DownloadIcon from "#/components/ui/download-icon";
import DotsHorizontalIcon from "#/components/ui/dots-horizontal-icon";
import BrandStripeIcon from "#/components/ui/brand-stripe-icon";
import HashtagIcon from "#/components/ui/hashtag-icon";
import MailFilledIcon from "#/components/ui/mail-filled-icon";
import Stack3Icon from "#/components/ui/stack-3-icon";
import {
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger
} from "#/components/ui/dropdown-menu";
import type { AnimatedIconHandle } from "#/components/ui/types";
import { AnimatedDropdownMenuItem } from "#studio/features/admin/components/AnimatedDropdownMenuItem";
import { copyText } from "#studio/features/admin/components/AdminDashboardTableUtils";
import { StripeIdCopyMenuItems } from "#studio/features/admin/components/StripeIdCopyMenuItems";
import type { usePackageActions } from "#studio/features/admin/hooks/usePackageActions";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";

type PackageOtherActionsMenuProps = {
	actions: ReturnType<typeof usePackageActions>;
	packageRow: AdminPackageRow;
};

type PackageInvoiceActionsProps = PackageOtherActionsMenuProps & { canResendPackageEmail: boolean };

type PackageReceiptMenuItemsProps = {
	actions: ReturnType<typeof usePackageActions>;
	canResendPackageEmail: boolean;
	isActionPending: boolean;
	pendingAction: ReturnType<typeof usePackageActions>["pendingAction"];
};

function PackageReceiptMenuItems({
	actions,
	canResendPackageEmail,
	isActionPending,
	pendingAction
}: PackageReceiptMenuItemsProps) {
	if (!canResendPackageEmail || !actions.hasStripeCustomer) return null;

	return (
		<>
			<AnimatedDropdownMenuItem
				disabled={isActionPending}
				onSelect={() => actions.setIsPackageEmailDialogOpen(true)}
				renderIcon={(iconRef) => (
					<MailFilledIcon
						ref={iconRef}
						size={16}
						aria-hidden
						className="shrink-0 text-current"
					/>
				)}>
				{pendingAction === "packageEmail" ? "Sending package email" : "Resend package email"}
			</AnimatedDropdownMenuItem>
			<AnimatedDropdownMenuItem
				disabled={isActionPending}
				onSelect={() => void actions.handleDownloadReceipt()}
				renderIcon={(iconRef) => (
					<DownloadIcon
						ref={iconRef}
						size={16}
						aria-hidden
						className="shrink-0 text-current"
					/>
				)}>
				{pendingAction === "receiptDownload" ? "Generating receipt" : "Download receipt"}
			</AnimatedDropdownMenuItem>
		</>
	);
}

function PackageInvoiceActions({
	actions,
	canResendPackageEmail,
	packageRow
}: PackageInvoiceActionsProps) {
	const {
		isActionPending,
		pendingAction,
		setIsAdjustmentInvoiceDialogOpen,
		setIsStripeBillingDialogOpen,
		setIsStripeInvoiceDialogOpen
	} = actions;

	return (
		<>
			<PackageReceiptMenuItems
				actions={actions}
				canResendPackageEmail={canResendPackageEmail}
				isActionPending={isActionPending}
				pendingAction={pendingAction}
			/>
			{packageRow.adjustment?.invoiceEmailStatus === "failed" ? (
				<AnimatedDropdownMenuItem
					disabled={isActionPending}
					onSelect={() => setIsAdjustmentInvoiceDialogOpen(true)}
					renderIcon={(iconRef) => (
						<MailFilledIcon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					{pendingAction === "adjustmentEmail"
						? "Sending adjustment invoice"
						: "Retry adjustment invoice"}
				</AnimatedDropdownMenuItem>
			) : null}
			{actions.hasStripeCustomer ? (
				<AnimatedDropdownMenuItem
					disabled={isActionPending || actions.isSendingStripeInvoice}
					onSelect={() => setIsStripeInvoiceDialogOpen(true)}
					renderIcon={(iconRef) => (
						<BrandStripeIcon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					Create Stripe invoice
				</AnimatedDropdownMenuItem>
			) : null}
			{actions.hasStripeBillingInvoices ? (
				<AnimatedDropdownMenuItem
					disabled={isActionPending}
					onSelect={() => setIsStripeBillingDialogOpen(true)}
					renderIcon={(iconRef) => (
						<BrandStripeIcon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					Stripe billing
				</AnimatedDropdownMenuItem>
			) : null}
		</>
	);
}

export function PackageOtherActionsMenu({ actions, packageRow }: PackageOtherActionsMenuProps) {
	const canResendPackageEmail = packageRow.isPaid;
	const hasPackageInvoiceActions = canResendPackageEmail || packageRow.adjustment !== null;
	const invoiceNumber = formatBookingInvoiceNumber(packageRow.id, packageRow.createdAt);
	const otherMenuIconRef = useRef<AnimatedIconHandle | null>(null);

	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger
				onPointerEnter={() => otherMenuIconRef.current?.startAnimation()}
				onPointerLeave={() => otherMenuIconRef.current?.stopAnimation()}
				onFocus={() => otherMenuIconRef.current?.startAnimation()}
				onBlur={() => otherMenuIconRef.current?.stopAnimation()}>
				<DotsHorizontalIcon
					ref={otherMenuIconRef}
					aria-hidden
				/>
				Other
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="w-60 touch-manipulation">
				<AnimatedDropdownMenuItem
					onSelect={() => void copyText(invoiceNumber, "invoice number")}
					renderIcon={(iconRef) => (
						<HashtagIcon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					{invoiceNumber}
				</AnimatedDropdownMenuItem>
				<AnimatedDropdownMenuItem
					onSelect={() => void navigator.clipboard.writeText(String(packageRow.id))}
					renderIcon={(iconRef) => (
						<Stack3Icon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					Copy database ID
				</AnimatedDropdownMenuItem>
				<StripeIdCopyMenuItems stripePaymentIntentId={packageRow.stripePaymentIntentId} />
				{hasPackageInvoiceActions ? (
					<>
						<DropdownMenuSeparator />
						<PackageInvoiceActions
							actions={actions}
							canResendPackageEmail={canResendPackageEmail}
							packageRow={packageRow}
						/>
					</>
				) : null}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
