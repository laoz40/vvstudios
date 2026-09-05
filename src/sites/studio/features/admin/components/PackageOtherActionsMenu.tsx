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
import type { usePackageActions } from "#studio/features/admin/hooks/usePackageActions";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";

type PackageOtherActionsMenuProps = {
	actions: ReturnType<typeof usePackageActions>;
	packageRow: AdminPackageRow;
};

type PackageInvoiceActionsProps = PackageOtherActionsMenuProps & {
	canSendInvoice: boolean;
	canSendNewSchedulingLink: boolean;
};

function PackageInvoiceActions({
	actions,
	canSendInvoice,
	canSendNewSchedulingLink,
	packageRow
}: PackageInvoiceActionsProps) {
	const {
		handleDownloadAdjustmentInvoice,
		handleDownloadInvoice,
		isActionPending,
		pendingAction,
		setIsAdjustmentInvoiceDialogOpen,
		setIsCustomInvoiceDialogOpen,
		setIsInvoiceDialogOpen,
		setIsSchedulingLinkDialogOpen
	} = actions;

	return (
		<>
			{canSendInvoice ? (
				<AnimatedDropdownMenuItem
					disabled={isActionPending}
					onSelect={() => setIsInvoiceDialogOpen(true)}
					renderIcon={(iconRef) => (
						<MailFilledIcon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					{pendingAction === "invoice" ? "Sending invoice..." : "Email invoice"}
				</AnimatedDropdownMenuItem>
			) : null}
			<AnimatedDropdownMenuItem
				disabled={isActionPending}
				onSelect={() => void handleDownloadInvoice()}
				renderIcon={(iconRef) => (
					<DownloadIcon
						ref={iconRef}
						size={16}
						aria-hidden
						className="shrink-0 text-current"
					/>
				)}>
				{pendingAction === "download" ? "Generating invoice..." : "Download invoice"}
			</AnimatedDropdownMenuItem>
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
			<AnimatedDropdownMenuItem
				disabled={isActionPending}
				onSelect={() => setIsCustomInvoiceDialogOpen(true)}
				renderIcon={(iconRef) => (
					<PenIcon
						ref={iconRef}
						size={16}
						aria-hidden
						className="shrink-0 text-current"
					/>
				)}>
				Create custom invoice
			</AnimatedDropdownMenuItem>
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
	const canSendInvoice =
		packageRow.status === "pending_payment" || packageRow.status === "invoice_email_failed";
	const canSendNewSchedulingLink = packageRow.isPaid;
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
				{canSendInvoice || canSendNewSchedulingLink ? (
					<>
						<DropdownMenuSeparator />
						<PackageInvoiceActions
							actions={actions}
							canSendInvoice={canSendInvoice}
							canSendNewSchedulingLink={canSendNewSchedulingLink}
							packageRow={packageRow}
						/>
					</>
				) : null}
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	);
}
