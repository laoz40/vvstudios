import { useRef } from "react";
import { Button } from "#/components/ui/button";
import AmbulanceIcon from "#/components/ui/ambulance-icon";
import ClockIcon from "#/components/ui/clock-icon";
import CurrencyDollarIcon from "#/components/ui/currency-dollar-icon";
import DotsHorizontalIcon from "#/components/ui/dots-horizontal-icon";
import DownloadIcon from "#/components/ui/download-icon";
import HashtagIcon from "#/components/ui/hashtag-icon";
import MailFilledIcon from "#/components/ui/mail-filled-icon";
import PenIcon from "#/components/ui/pen-icon";
import PhoneVolume from "#/components/ui/phone-volume";
import SendIcon from "#/components/ui/send-icon";
import Stack3Icon from "#/components/ui/stack-3-icon";
import TrashIcon from "#/components/ui/trash-icon";
import type { AnimatedIconHandle } from "#/components/ui/types";
import { cn } from "#/lib/utils";
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
import { AnimatedDropdownMenuItem } from "#studio/features/admin/components/AnimatedDropdownMenuItem";
import { StatusCircleButton } from "#studio/features/admin/components/StatusCircleButton";
import {
	EDIT_STATUS_OPTIONS,
	deliverableStatusDotClassNameMap,
	deliverableStatusLabelMap
} from "#studio/features/admin/lib/booking-edit-status";
import type { BookingActionDetails } from "#studio/features/admin/lib/admin-bookings";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";
import type { useDeleteAction } from "#studio/features/admin/hooks/useDeleteAction";
import type { useDeliverablesEmailAction } from "#studio/features/admin/hooks/useDeliverablesEmailAction";
import type { useEditAction } from "#studio/features/admin/hooks/useEditAction";
import type { useInvoiceActions } from "#studio/features/admin/hooks/useInvoiceActions";
import type { usePaymentActions } from "#studio/features/admin/hooks/usePaymentActions";
import type { useRescheduleAction } from "#studio/features/admin/hooks/useRescheduleAction";
import type { useStatusActions } from "#studio/features/admin/hooks/useStatusActions";

type SessionActionsMenuProps = {
	booking: BookingRecord;
	details: BookingActionDetails;
	deleteAction: ReturnType<typeof useDeleteAction>;
	deliverablesEmailAction: ReturnType<typeof useDeliverablesEmailAction>;
	editAction: ReturnType<typeof useEditAction>;
	invoiceActions: ReturnType<typeof useInvoiceActions>;
	paymentActions: ReturnType<typeof usePaymentActions>;
	rescheduleAction: ReturnType<typeof useRescheduleAction>;
	statusActions: ReturnType<typeof useStatusActions>;
};

export function SessionActionsMenu({
	booking,
	details,
	deleteAction,
	deliverablesEmailAction,
	editAction,
	invoiceActions,
	paymentActions,
	rescheduleAction,
	statusActions
}: SessionActionsMenuProps) {
	// Menu icon animation refs
	const menuIconRef = useRef<AnimatedIconHandle | null>(null);
	const otherMenuIconRef = useRef<AnimatedIconHandle | null>(null);
	const emailIconRef = useRef<AnimatedIconHandle | null>(null);
	const phoneIconRef = useRef<AnimatedIconHandle | null>(null);

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
					<span className="sr-only">Open session actions</span>
					<DotsHorizontalIcon
						ref={menuIconRef}
						aria-hidden
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-72 touch-manipulation">
				<DropdownMenuGroup>
					<div className="flex items-center gap-2 px-2 py-1">
						<a
							href={`mailto:${booking.email}`}
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
						{booking.phone ? (
							<a
								href={`tel:${booking.phone}`}
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
						) : null}
					</div>
				</DropdownMenuGroup>
				{details.canManageConfirmedBooking ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="text-muted-foreground text-sm">
							Payment status
						</DropdownMenuLabel>
						<div className="flex items-center gap-2 px-2 pb-2">
							<StatusCircleButton
								ariaLabel="Mark balance unpaid"
								className="bg-destructive"
								disabled={
									paymentActions.isUpdatingPaidRemainingBalance ||
									!paymentActions.isPaidRemainingBalance
								}
								isSelected={!paymentActions.isPaidRemainingBalance}
								onClick={() => {
									void paymentActions.handleSetPaidRemainingBalance(false);
								}}
							/>
							<StatusCircleButton
								ariaLabel="Mark balance paid"
								className="bg-green"
								disabled={
									paymentActions.isUpdatingPaidRemainingBalance ||
									paymentActions.isPaidRemainingBalance
								}
								isSelected={paymentActions.isPaidRemainingBalance}
								onClick={() => {
									void paymentActions.handleSetPaidRemainingBalance(true);
								}}
							/>
						</div>
					</>
				) : null}
				<DropdownMenuSeparator />
				{details.canManageConfirmedBooking && details.isPastBooking ? (
					<>
						<DropdownMenuLabel className="text-muted-foreground text-sm">
							Deliverables status
						</DropdownMenuLabel>
						<div className="flex items-center gap-2 px-2 pb-2">
							{EDIT_STATUS_OPTIONS.map((option) => (
								<StatusCircleButton
									key={option}
									ariaLabel={deliverableStatusLabelMap[option]}
									className={deliverableStatusDotClassNameMap[option]}
									disabled={
										statusActions.isUpdatingEditStatus || statusActions.deliverableStatus === option
									}
									isSelected={statusActions.deliverableStatus === option}
									onClick={() => {
										void statusActions.handleUpdateEditStatus(option);
									}}
								/>
							))}
						</div>
						<DropdownMenuSeparator />
						<AnimatedDropdownMenuItem
							className="focus:text-green hover:text-green"
							disabled={deliverablesEmailAction.isEmailingDeliverables}
							onSelect={() => deliverablesEmailAction.setIsDeliverablesEmailDialogOpen(true)}
							renderIcon={(iconRef) => (
								<SendIcon
									ref={iconRef}
									size={16}
									aria-hidden
									className="shrink-0 text-current"
								/>
							)}>
							Deliver deliverables email
						</AnimatedDropdownMenuItem>
						<DropdownMenuSeparator />
					</>
				) : null}
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
					<DropdownMenuSubContent className="w-72 touch-manipulation">
						{details.canManageConfirmedBooking ? (
							<>
								<AnimatedDropdownMenuItem
									onSelect={() => navigator.clipboard.writeText(details.customerBookingId)}
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
									onSelect={() => navigator.clipboard.writeText(String(booking._id))}
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
								<DropdownMenuSeparator />
								<AnimatedDropdownMenuItem
									disabled={invoiceActions.isDownloadingInvoice}
									onSelect={invoiceActions.handleDownloadInvoice}
									renderIcon={(iconRef) => (
										<DownloadIcon
											ref={iconRef}
											size={16}
											aria-hidden
											className="shrink-0 text-current"
										/>
									)}>
									{invoiceActions.isDownloadingInvoice
										? "Generating invoice..."
										: "Download invoice"}
								</AnimatedDropdownMenuItem>
								<AnimatedDropdownMenuItem
									disabled={invoiceActions.isEmailingInvoice}
									onSelect={() => invoiceActions.setIsEmailInvoiceDialogOpen(true)}
									renderIcon={(iconRef) => (
										<MailFilledIcon
											ref={iconRef}
											size={16}
											aria-hidden
											className="shrink-0 text-current"
										/>
									)}>
									Email invoice
								</AnimatedDropdownMenuItem>
								<AnimatedDropdownMenuItem
									onSelect={() => invoiceActions.setIsCustomInvoiceDialogOpen(true)}
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
								<AnimatedDropdownMenuItem
									onSelect={() => paymentActions.setIsRemainingBalanceDialogOpen(true)}
									renderIcon={(iconRef) => (
										<CurrencyDollarIcon
											ref={iconRef}
											size={16}
											aria-hidden
											className="shrink-0 text-current"
										/>
									)}>
									Set remaining balance
								</AnimatedDropdownMenuItem>
							</>
						) : (
							<AnimatedDropdownMenuItem
								onSelect={() => navigator.clipboard.writeText(String(booking._id))}
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
						)}
						<DropdownMenuSeparator />
						<AnimatedDropdownMenuItem
							disabled={
								!details.canGenerateRescheduleLink || rescheduleAction.isGeneratingRescheduleLink
							}
							onSelect={rescheduleAction.openRescheduleLinkDialog}
							renderIcon={(iconRef) => (
								<ClockIcon
									ref={iconRef}
									size={16}
									aria-hidden
									className="shrink-0 text-current"
								/>
							)}>
							Generate reschedule link
						</AnimatedDropdownMenuItem>
						{details.canToggleStatus ? (
							<>
								<DropdownMenuSeparator />
								<AnimatedDropdownMenuItem
									className={
										details.canManageConfirmedBooking
											? "focus:text-destructive hover:text-destructive"
											: "focus:text-green hover:text-green"
									}
									disabled={statusActions.isUpdatingStatus}
									onSelect={statusActions.handleToggleStatus}
									renderIcon={(iconRef) => (
										<AmbulanceIcon
											ref={iconRef}
											size={16}
											aria-hidden
											className="shrink-0 text-current"
										/>
									)}>
									{details.toggleStatusLabel}
								</AnimatedDropdownMenuItem>
							</>
						) : null}
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSeparator />
				<AnimatedDropdownMenuItem
					className="focus:text-destructive hover:text-destructive"
					onSelect={() => editAction.setIsEditDialogOpen(true)}
					renderIcon={(iconRef) => (
						<PenIcon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					Edit session
				</AnimatedDropdownMenuItem>
				<AnimatedDropdownMenuItem
					className="focus:text-destructive hover:text-destructive"
					onSelect={() => deleteAction.setIsDeleteDialogOpen(true)}
					renderIcon={(iconRef) => (
						<TrashIcon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					Delete event
				</AnimatedDropdownMenuItem>
				<AnimatedDropdownMenuItem
					disabled={deleteAction.isArchiving}
					onSelect={() => void deleteAction.handleArchiveSession()}
					renderIcon={(iconRef) => (
						<Stack3Icon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					{deleteAction.isArchiving ? "Archiving session..." : "Archive session"}
				</AnimatedDropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
