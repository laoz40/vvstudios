import { useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import DownloadIcon from "#/components/ui/download-icon";
import DotsHorizontalIcon from "#/components/ui/dots-horizontal-icon";
import HashtagIcon from "#/components/ui/hashtag-icon";
import MailFilledIcon from "#/components/ui/mail-filled-icon";
import PenIcon from "#/components/ui/pen-icon";
import PhoneVolume from "#/components/ui/phone-volume";
import Stack3Icon from "#/components/ui/stack-3-icon";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger
} from "#/components/ui/dropdown-menu";
import type { AnimatedIconHandle } from "#/components/ui/types";
import { cn } from "#/lib/utils";
import { tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import type { ArchivePackageResult, MarkPackagePaymentStatusResult } from "#convex/bookings";
import type { GetAdminMultiBookingInvoicePdfByIdResult } from "#convex/invoices";
import type {
	ConfirmPackagePaymentResult,
	ResendMultiBookingInvoiceEmailResult,
	RetryMultiBookingSchedulingEmailResult
} from "#convex/multiBookings";
import { AnimatedDropdownMenuItem } from "#studio/features/admin/components/AnimatedDropdownMenuItem";
import { AdminEditConfirmationDialog } from "#studio/features/admin/components/AdminEditConfirmationDialog";
import { PackageEmailConfirmationDialog } from "#studio/features/admin/components/PackageEmailConfirmationDialog";
import { PackageEditDialog } from "#studio/features/admin/components/PackageEditDialog";
import { PackagePaymentConfirmationDialog } from "#studio/features/admin/components/PackagePaymentConfirmationDialog";
import { StatusCircleButton } from "#studio/features/admin/components/StatusCircleButton";
import {
	getPackageArchiveActionLabel,
	type AdminPackagePendingAction,
	type AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";
import { usePackageEditAction } from "#studio/features/admin/hooks/usePackageEditAction";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { downloadBlob } from "#studio/features/booking-invoice/pdf/download-blob";

export function PackageActions({ packageRow }: { packageRow: AdminPackageRow }) {
	const resendInvoice = useAction(api.multiBookings.resendMultiBookingInvoiceEmail);
	const confirmPackagePayment = useAction(api.multiBookings.confirmPackagePayment);
	const retrySchedulingEmail = useAction(api.multiBookings.retryMultiBookingSchedulingEmail);
	const getAdminPackageInvoicePdf = useAction(api.invoices.getAdminMultiBookingInvoicePdfById);
	const archivePackage = useMutation(api.bookings.archivePackage);
	const markPaymentStatus = useMutation(api.bookings.markPackagePaymentStatus);
	const editAction = usePackageEditAction(packageRow);

	const [pendingAction, setPendingAction] = useState<AdminPackagePendingAction>(null);
	const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
	const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
	const [isSchedulingLinkDialogOpen, setIsSchedulingLinkDialogOpen] = useState(false);

	const canSendInvoice =
		packageRow.status === "pending_payment" || packageRow.status === "invoice_email_failed";
	const canSendNewSchedulingLink = packageRow.isPaid;
	const isActionPending = pendingAction !== null;
	const invoiceNumber = formatBookingInvoiceNumber(packageRow.id, packageRow.createdAt);

	// Menu icon animation refs
	const menuIconRef = useRef<AnimatedIconHandle | null>(null);
	const otherMenuIconRef = useRef<AnimatedIconHandle | null>(null);
	const emailIconRef = useRef<AnimatedIconHandle | null>(null);
	const phoneIconRef = useRef<AnimatedIconHandle | null>(null);

	async function handleDownloadInvoice() {
		setPendingAction("download");

		const [error, invoice] = await tryCatch<GetAdminMultiBookingInvoicePdfByIdResult>(
			getAdminPackageInvoicePdf({ multiBookingId: packageRow.id })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to download package invoices.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "INVALID_BOOKING_DATA":
				case "INVOICE_DOWNLOAD_FAILED":
				case "INVOICE_EMAIL_RENDER_FAILED":
				case "UNEXPECTED_ERROR":
					toast.error("Unable to generate package invoice.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setPendingAction(null);
			return;
		}

		downloadBlob(new Blob([invoice.content], { type: invoice.contentType }), invoice.filename);
		toast.success("Package invoice download started.");
		setPendingAction(null);
	}
	async function handleResendInvoice() {
		setPendingAction("invoice");

		const [error] = await tryCatch<ResendMultiBookingInvoiceEmailResult>(
			resendInvoice({ multiBookingId: packageRow.id })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to send package invoices.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "PACKAGE_NOT_UNPAID":
					toast.error("Only unpaid packages can receive invoice retries.");
					break;

				case "PACKAGE_INVOICE_EMAIL_FAILED":
					toast.error("Package invoice email failed again.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while sending the invoice.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setPendingAction(null);
			return;
		}

		toast.success("Package invoice sent.");
		setIsInvoiceDialogOpen(false);
		setPendingAction(null);
	}

	async function handleArchiveChange(archived: boolean) {
		setPendingAction("archive");

		const [error] = await tryCatch<ArchivePackageResult>(
			archivePackage({ multiBookingId: packageRow.id, archived })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to archive packages.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "PACKAGE_ARCHIVE_FAILED":
					toast.error("Unable to update the package archive state.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while archiving the package.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setPendingAction(null);
			return;
		}

		toast.success(archived ? "Package archived." : "Package restored.");
		setPendingAction(null);
	}

	async function handlePaymentChange(paid: boolean) {
		setPendingAction("payment");

		const [error] = await tryCatch<MarkPackagePaymentStatusResult>(
			markPaymentStatus({ multiBookingId: packageRow.id, paid })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to update package payment.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "PACKAGE_PAYMENT_CONFIRMATION_REQUIRED":
					toast.error("Confirm package payments from the payment dialog.");
					break;

				case "PACKAGE_PAYMENT_STATUS_UPDATE_FAILED":
					toast.error("Unable to update package payment.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while updating package payment.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setPendingAction(null);
			return;
		}

		toast.success(paid ? "Package marked paid." : "Package marked unpaid.");
		setPendingAction(null);
	}

	async function handleConfirmPayment() {
		setPendingAction("payment");

		const [error] = await tryCatch<ConfirmPackagePaymentResult>(
			confirmPackagePayment({ multiBookingId: packageRow.id })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to confirm package payments.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "PACKAGE_ALREADY_PAID":
					toast.error("This package is already marked paid.");
					break;

				case "PACKAGE_NOT_UNPAID":
					toast.error("Only unpaid packages can be confirmed as paid.");
					break;

				case "PACKAGE_PAYMENT_STATUS_UPDATE_FAILED":
					toast.error("Unable to mark this package paid.");
					break;

				case "PACKAGE_SCHEDULE_EMAIL_FAILED":
					toast.error("Package was marked paid, but the scheduling email failed.");
					setIsPaymentDialogOpen(false);
					break;

				case "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED":
					toast.error(
						"Package was marked paid, but the scheduling email failed and we could not save that failure status."
					);
					setIsPaymentDialogOpen(false);
					break;

				case "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED":
					toast.error("Scheduling email sent, but the package status did not update.");
					setIsPaymentDialogOpen(false);
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while confirming payment.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setPendingAction(null);
			return;
		}

		toast.success("Package marked paid and scheduling email sent.");
		setIsPaymentDialogOpen(false);
		setPendingAction(null);
	}

	async function handleRetrySchedulingEmail() {
		setPendingAction("scheduleEmail");

		const [error] = await tryCatch<RetryMultiBookingSchedulingEmailResult>(
			retrySchedulingEmail({ multiBookingId: packageRow.id })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to send scheduling links.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "PACKAGE_SCHEDULE_EMAIL_NOT_RETRYABLE":
					toast.error("Only paid packages can receive a new scheduling link.");
					break;

				case "PACKAGE_SCHEDULE_LINK_NOT_READY":
					toast.error("This package does not have an active scheduling window yet.");
					break;

				case "PACKAGE_SCHEDULE_TOKEN_UPDATE_FAILED":
					toast.error("Unable to refresh the scheduling link.");
					break;

				case "PACKAGE_SCHEDULE_EMAIL_FAILED":
					toast.error("Scheduling email failed again.");
					break;

				case "PACKAGE_SCHEDULE_EMAIL_FAILED_AND_STATUS_UPDATE_FAILED":
					toast.error("Scheduling email failed again, and we could not save that failure status.");
					break;

				case "PACKAGE_SCHEDULE_EMAIL_SENT_STATUS_UPDATE_FAILED":
					toast.error("Scheduling email sent, but the package status did not update.");
					setIsSchedulingLinkDialogOpen(false);
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while sending the scheduling link.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setPendingAction(null);
			return;
		}

		toast.success("Scheduling email sent.");
		setIsSchedulingLinkDialogOpen(false);
		setPendingAction(null);
	}

	return (
		<>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						className="touch-manipulation"
						onPointerEnter={() => menuIconRef.current?.startAnimation()}
						onPointerLeave={() => menuIconRef.current?.stopAnimation()}
						onFocus={() => menuIconRef.current?.startAnimation()}
						onBlur={() => menuIconRef.current?.stopAnimation()}>
						<span className="sr-only">Open package actions</span>
						<DotsHorizontalIcon
							ref={menuIconRef}
							aria-hidden
						/>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					className="w-60 touch-manipulation">
					<DropdownMenuGroup>
						<div className="flex items-center gap-2 px-2 py-1">
							<a
								href={`mailto:${packageRow.customerEmail}`}
								aria-label="Email customer"
								title="Email customer"
								className={cn(
									"flex size-8 items-center justify-center",
									"rounded-sm",
									"text-muted-foreground",
									"hover:bg-accent hover:text-accent-foreground",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								)}
								onPointerEnter={() => emailIconRef.current?.startAnimation()}
								onPointerLeave={() => emailIconRef.current?.stopAnimation()}
								onFocus={() => emailIconRef.current?.startAnimation()}
								onBlur={() => emailIconRef.current?.stopAnimation()}>
								<MailFilledIcon
									ref={emailIconRef}
									size={20}
									aria-hidden
								/>
							</a>
							<a
								href={`tel:${packageRow.customerPhone}`}
								aria-label="Call customer"
								title="Call customer"
								className={cn(
									"flex size-8 items-center justify-center",
									"rounded-sm",
									"text-muted-foreground",
									"hover:bg-accent hover:text-accent-foreground",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								)}
								onPointerEnter={() => phoneIconRef.current?.startAnimation()}
								onPointerLeave={() => phoneIconRef.current?.stopAnimation()}
								onFocus={() => phoneIconRef.current?.startAnimation()}
								onBlur={() => phoneIconRef.current?.stopAnimation()}>
								<PhoneVolume
									ref={phoneIconRef}
									size={20}
									aria-hidden
								/>
							</a>
						</div>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuLabel className="text-muted-foreground text-sm">
						Payment status
					</DropdownMenuLabel>
					<div className="flex items-center gap-2 px-2 pb-2">
						<StatusCircleButton
							ariaLabel="Mark package unpaid"
							className="bg-destructive"
							disabled={isActionPending || !packageRow.isPaid}
							isSelected={!packageRow.isPaid}
							onClick={() => {
								void handlePaymentChange(false);
							}}
						/>
						<StatusCircleButton
							ariaLabel="Mark package paid"
							className="bg-green"
							disabled={isActionPending || packageRow.isPaid}
							isSelected={packageRow.isPaid}
							onClick={() => setIsPaymentDialogOpen(true)}
						/>
					</div>
					<DropdownMenuSeparator />
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
								onSelect={() => navigator.clipboard.writeText(invoiceNumber)}
								renderIcon={(iconRef) => (
									<HashtagIcon
										ref={iconRef}
										size={16}
										aria-hidden
										className="shrink-0 text-current"
									/>
								)}>
								Copy invoice number
							</AnimatedDropdownMenuItem>
							<AnimatedDropdownMenuItem
								onSelect={() => navigator.clipboard.writeText(String(packageRow.id))}
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
							) : null}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
					<DropdownMenuSeparator />
					<AnimatedDropdownMenuItem
						disabled={isActionPending || editAction.isSaving}
						onSelect={() => editAction.setIsEditDialogOpen(true)}
						renderIcon={(iconRef) => (
							<PenIcon
								ref={iconRef}
								size={16}
								aria-hidden
								className="shrink-0 text-current"
							/>
						)}>
						Edit package
					</AnimatedDropdownMenuItem>
					<AnimatedDropdownMenuItem
						disabled={isActionPending}
						onSelect={() => void handleArchiveChange(packageRow.hiddenAt === undefined)}
						renderIcon={(iconRef) => (
							<Stack3Icon
								ref={iconRef}
								size={16}
								aria-hidden
								className="shrink-0 text-current"
							/>
						)}>
						{getPackageArchiveActionLabel(packageRow, pendingAction)}
					</AnimatedDropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<PackageEditDialog
				open={editAction.isEditDialogOpen}
				packageRow={packageRow}
				onOpenChange={editAction.setIsEditDialogOpen}
				onSave={editAction.handleEditPackage}
				isSaving={editAction.isSaving}
			/>
			<AdminEditConfirmationDialog
				open={editAction.isEditConfirmationDialogOpen}
				isSaving={editAction.isSaving}
				googleEventFieldLabels={editAction.pendingEditWarningState?.changedFieldLabels ?? []}
				nonPricingTitle="Package info will update"
				pricingTitle="Pricing may recalculate"
				description="Review what this save will affect before making the package changes permanent."
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
				open={isPaymentDialogOpen}
				onOpenChange={setIsPaymentDialogOpen}
				packageRow={packageRow}
				isConfirming={pendingAction === "payment"}
				onConfirm={() => void handleConfirmPayment()}
			/>
			<PackageEmailConfirmationDialog
				open={isInvoiceDialogOpen}
				customerName={packageRow.customerName}
				customerEmail={packageRow.customerEmail}
				description="Confirm before sending the package invoice email to this customer."
				isSending={pendingAction === "invoice"}
				sendLabel="Email invoice"
				sendingLabel="Sending invoice..."
				title="Email package invoice to customer?"
				onOpenChange={setIsInvoiceDialogOpen}
				onSend={() => void handleResendInvoice()}
			/>
			<PackageEmailConfirmationDialog
				open={isSchedulingLinkDialogOpen}
				customerName={packageRow.customerName}
				customerEmail={packageRow.customerEmail}
				description="This will create a fresh scheduling link for this package. Any previous scheduling link will stop working."
				isSending={pendingAction === "scheduleEmail"}
				sendLabel="Send New Scheduling Link"
				sendingLabel="Sending scheduling link..."
				title="Send new scheduling link to customer?"
				onOpenChange={setIsSchedulingLinkDialogOpen}
				onSend={() => void handleRetrySchedulingEmail()}
			/>
		</>
	);
}
