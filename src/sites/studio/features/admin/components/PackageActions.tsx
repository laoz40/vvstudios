import { useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import DotsHorizontalIcon from "#/components/ui/dots-horizontal-icon";
import HashtagIcon from "#/components/ui/hashtag-icon";
import MailFilledIcon from "#/components/ui/mail-filled-icon";
import PhoneVolume from "#/components/ui/phone-volume";
import Stack3Icon from "#/components/ui/stack-3-icon";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
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
import type {
	ArchiveMultiBookingPackageResult,
	MarkMultiBookingPackagePaymentStatusResult
} from "#convex/bookings";
import type { ResendMultiBookingInvoiceEmailResult } from "#convex/multiBookings";
import { AnimatedDropdownMenuItem } from "#studio/features/admin/components/AnimatedDropdownMenuItem";
import { StatusCircleButton } from "#studio/features/admin/components/StatusCircleButton";
import {
	getPackageArchiveActionLabel,
	type AdminPackagePendingAction,
	type AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";

export function PackageActions({ packageRow }: { packageRow: AdminPackageRow }) {
	const resendInvoice = useAction(api.multiBookings.resendMultiBookingInvoiceEmail);
	const archivePackage = useMutation(api.bookings.archiveMultiBookingPackage);
	const markPaymentStatus = useMutation(api.bookings.markMultiBookingPackagePaymentStatus);
	const [pendingAction, setPendingAction] = useState<AdminPackagePendingAction>(null);
	const canSendInvoice =
		packageRow.status === "pending_payment" || packageRow.status === "invoice_email_failed";
	const canRetrySchedulingLink = packageRow.status === "schedule_email_failed";
	const isActionPending = pendingAction !== null;
	const invoiceNumber = formatBookingInvoiceNumber(packageRow.id, packageRow.createdAt);

	// Menu icon animation refs
	const menuIconRef = useRef<AnimatedIconHandle | null>(null);
	const otherMenuIconRef = useRef<AnimatedIconHandle | null>(null);
	const emailIconRef = useRef<AnimatedIconHandle | null>(null);
	const phoneIconRef = useRef<AnimatedIconHandle | null>(null);

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
		setPendingAction(null);
	}

	async function handleArchiveChange(archived: boolean) {
		setPendingAction("archive");

		const [error] = await tryCatch<ArchiveMultiBookingPackageResult>(
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

		const [error] = await tryCatch<MarkMultiBookingPackagePaymentStatusResult>(
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

	return (
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
						disabled={isActionPending}
						isSelected={!packageRow.isPaid}
						onClick={() => {
							void handlePaymentChange(false);
						}}
					/>
					<StatusCircleButton
						ariaLabel="Mark package paid"
						className="bg-green"
						disabled={isActionPending}
						isSelected={packageRow.isPaid}
						onClick={() => {
							void handlePaymentChange(true);
						}}
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
							onClick={() => navigator.clipboard.writeText(invoiceNumber)}
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
							onClick={() => navigator.clipboard.writeText(String(packageRow.id))}
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
						{canSendInvoice ? (
							<>
								<DropdownMenuSeparator />
								<AnimatedDropdownMenuItem
									disabled={isActionPending}
									onSelect={() => void handleResendInvoice()}
									renderIcon={(iconRef) => (
										<MailFilledIcon
											ref={iconRef}
											size={16}
											aria-hidden
											className="shrink-0 text-current"
										/>
									)}>
									{pendingAction === "invoice" ? "Sending invoice..." : "Send invoice"}
								</AnimatedDropdownMenuItem>
							</>
						) : null}
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSeparator />
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
				{canRetrySchedulingLink ? (
					<DropdownMenuItem disabled>
						<RefreshCw aria-hidden />
						Retry scheduling link later
					</DropdownMenuItem>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
