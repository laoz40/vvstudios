import { useRef } from "react";
import DownloadIcon from "#/components/ui/download-icon";
import DotsHorizontalIcon from "#/components/ui/dots-horizontal-icon";
import HashtagIcon from "#/components/ui/hashtag-icon";
import MailFilledIcon from "#/components/ui/mail-filled-icon";
import PenIcon from "#/components/ui/pen-icon";
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
import { LegacyInvoicesSubmenu } from "#studio/features/admin/components/LegacyInvoicesSubmenu";
import { StripeIdCopyMenuItems } from "#studio/features/admin/components/StripeIdCopyMenuItems";
import type { usePackageActions } from "#studio/features/admin/hooks/usePackageActions";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";

type PackageOtherActionsMenuProps = {
	actions: ReturnType<typeof usePackageActions>;
	packageRow: AdminPackageRow;
};

type PackageInvoiceActionsProps = PackageOtherActionsMenuProps & {
	canSendNewSchedulingLink: boolean;
};

function PackageInvoiceActions({
	actions,
	canSendNewSchedulingLink,
	packageRow
}: PackageInvoiceActionsProps) {
	const {
		handleDownloadAdjustmentInvoice,
		handleDownloadInvoice,
		handleResendReceipt,
		isActionPending,
		pendingAction,
		setIsAdjustmentInvoiceDialogOpen,
		setIsLegacyCustomInvoicesDialogOpen,
		setIsSchedulingLinkDialogOpen,
		setIsStripeInvoiceDialogOpen
	} = actions;

	return (
		<>
			{canSendNewSchedulingLink && actions.hasStripeCustomer ? (
				<AnimatedDropdownMenuItem
					disabled={isActionPending}
					onSelect={() => void handleResendReceipt()}
					renderIcon={(iconRef) => (
						<MailFilledIcon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					Resend receipt
				</AnimatedDropdownMenuItem>
			) : null}
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
			{packageRow.adjustment?.invoiceEmailStatus === "sent" ? (
				<AnimatedDropdownMenuItem
					disabled={isActionPending}
					onSelect={() => void handleDownloadAdjustmentInvoice()}
					renderIcon={(iconRef) => (
						<DownloadIcon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					{pendingAction === "adjustmentDownload"
						? "Generating adjustment invoice"
						: "Download adjustment invoice"}
				</AnimatedDropdownMenuItem>
			) : null}
			{actions.hasStripeCustomer ? (
				<AnimatedDropdownMenuItem
					disabled={isActionPending || actions.isSendingStripeInvoice}
					onSelect={() => setIsStripeInvoiceDialogOpen(true)}
					renderIcon={(iconRef) => (
						<PenIcon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					Send Stripe invoice
				</AnimatedDropdownMenuItem>
			) : null}
			{packageRow.stripeCustomerId === undefined ? (
				<LegacyInvoicesSubmenu
					downloadingLegacyCustomInvoiceId={actions.downloadingLegacyCustomInvoiceId}
					downloadLabel={pendingAction === "download" ? "Generating invoice" : "Download invoice"}
					isDisabled={isActionPending}
					isDownloadingInvoice={pendingAction === "download"}
					onDownloadInvoice={() => {
						void handleDownloadInvoice();
					}}
					onOpenCustomInvoices={() => setIsLegacyCustomInvoicesDialogOpen(true)}
				/>
			) : null}
			{canSendNewSchedulingLink ? (
				<AnimatedDropdownMenuItem
					disabled={isActionPending}
					onSelect={() => setIsSchedulingLinkDialogOpen(true)}
					renderIcon={(iconRef) => (
						<MailFilledIcon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					{pendingAction === "scheduleEmail"
						? "Sending scheduling link..."
						: "Send New Scheduling Link"}
				</AnimatedDropdownMenuItem>
			) : null}
		</>
	);
}

export function PackageOtherActionsMenu({ actions, packageRow }: PackageOtherActionsMenuProps) {
	const canSendNewSchedulingLink = packageRow.isPaid;
	const hasPackageInvoiceActions = canSendNewSchedulingLink || packageRow.adjustment !== null;
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
							canSendNewSchedulingLink={canSendNewSchedulingLink}
							packageRow={packageRow}
						/>
					</>
				) : null}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
