import {
	useEffect,
	useRef,
	useState,
	type ComponentProps,
	type ReactNode,
	type RefObject,
} from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import AmbulanceIcon from "#/components/ui/ambulance-icon";
import DotsHorizontalIcon from "#/components/ui/dots-horizontal-icon";
import DownloadIcon from "#/components/ui/download-icon";
import CurrencyDollarIcon from "#/components/ui/currency-dollar-icon";
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
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { downloadAdminBookingInvoice } from "#studio/features/admin/lib/download-admin-booking-invoice";
import { bookingSchema } from "#studio/features/booking-form/lib/form-shared";
import { BookingDeleteDialog } from "#studio/features/admin/components/BookingDeleteDialog";
import {
	BookingEditDialog,
	type BookingEditDraft,
} from "#studio/features/admin/components/BookingEditDialog";
import { CustomInvoiceDialog } from "#studio/features/admin/components/CustomInvoiceDialog";
import { EmailInvoiceDialog } from "#studio/features/admin/components/EmailInvoiceDialog";
import { DeliverablesEmailDialog } from "#studio/features/admin/components/DeliverablesEmailDialog";
import { RemainingBalanceDialog } from "#studio/features/admin/components/RemainingBalanceDialog";
import {
	EDIT_STATUS_OPTIONS,
	deliverableStatusDotClassNameMap,
	deliverableStatusLabelMap,
	getDeliverableStatus,
	type DeliverableStatus,
} from "#studio/features/admin/lib/booking-edit-status";
import {
	getBookingInvoiceEmailErrorMessage,
	getBookingMutationErrorMessage,
	getBookingStatusMutationErrorMessage,
	getDeleteBookingErrorMessage,
} from "#studio/features/admin/lib/booking-action-errors";
import { getBookingDeliverablesEmailErrorMessage } from "#studio/features/admin/lib/booking-email-errors";
import type { DeliverablesEmailVariant } from "#studio/features/deliverables-email/lib/constants";
import { getRemainingBalanceAmount } from "#studio/features/admin/lib/remaining-balance";
import { isUpcomingBooking } from "#studio/lib/bookingdatetime";

type BookingRecord = Doc<"bookings">;

export type BookingActionsProps = {
	booking: BookingRecord;
};

type StatusCircleButtonProps = {
	ariaLabel: string;
	className: string;
	disabled?: boolean;
	isSelected: boolean;
	onClick: () => void;
};

function StatusCircleButton({
	ariaLabel,
	className,
	disabled,
	isSelected,
	onClick,
}: StatusCircleButtonProps) {
	return (
		<button
			type="button"
			aria-label={ariaLabel}
			title={ariaLabel}
			disabled={disabled}
			className={cn(
				"size-5 rounded-full border border-transparent disabled:opacity-50",
				className,
				isSelected && "ring-2 ring-accent-foreground ring-offset-2 ring-offset-popover",
			)}
			onClick={onClick}
		/>
	);
}

type AnimatedDropdownMenuItemProps = ComponentProps<typeof DropdownMenuItem> & {
	children: ReactNode;
	renderIcon: (ref: RefObject<AnimatedIconHandle | null>) => ReactNode;
};

function AnimatedDropdownMenuItem({
	children,
	renderIcon,
	onBlur,
	onFocus,
	onPointerEnter,
	onPointerLeave,
	...props
}: AnimatedDropdownMenuItemProps) {
	const iconRef = useRef<AnimatedIconHandle | null>(null);

	return (
		<DropdownMenuItem
			{...props}
			onPointerEnter={(event) => {
				onPointerEnter?.(event);
				iconRef.current?.startAnimation();
			}}
			onPointerLeave={(event) => {
				onPointerLeave?.(event);
				iconRef.current?.stopAnimation();
			}}
			onFocus={(event) => {
				onFocus?.(event);
				iconRef.current?.startAnimation();
			}}
			onBlur={(event) => {
				onBlur?.(event);
				iconRef.current?.stopAnimation();
			}}>
			{renderIcon(iconRef)}
			<span>{children}</span>
		</DropdownMenuItem>
	);
}

export function BookingActions({ booking }: BookingActionsProps) {
	const deleteBooking = useMutation(api.bookings.deleteBooking);
	const sendBookingDeliverablesEmailForBooking = useAction(
		api.deliverablesEmail.sendBookingDeliverablesEmailForBooking,
	);
	const sendBookingInvoiceForBooking = useAction(api.googleCalendar.sendBookingInvoiceForBooking);
	const updateBooking = useAction(api.googleCalendar.updateBookingFromAdmin);
	const updateBookingEditStatus = useMutation(api.bookings.updateBookingEditStatus);
	const updateBookingPaidRemainingBalance = useMutation(
		api.bookings.updateBookingPaidRemainingBalance,
	);
	const updateBookingRemainingBalanceAmount = useMutation(
		api.bookings.updateBookingRemainingBalanceAmount,
	);
	const updateBookingStatus = useMutation(api.bookings.updateBookingStatus);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isEmailInvoiceDialogOpen, setIsEmailInvoiceDialogOpen] = useState(false);
	const [isCustomInvoiceDialogOpen, setIsCustomInvoiceDialogOpen] = useState(false);
	const [isDeliverablesEmailDialogOpen, setIsDeliverablesEmailDialogOpen] = useState(false);
	const [isRemainingBalanceDialogOpen, setIsRemainingBalanceDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isEmailingDeliverables, setIsEmailingDeliverables] = useState(false);
	const [isEmailingInvoice, setIsEmailingInvoice] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
	const menuIconRef = useRef<AnimatedIconHandle | null>(null);
	const otherMenuIconRef = useRef<AnimatedIconHandle | null>(null);
	const emailIconRef = useRef<AnimatedIconHandle | null>(null);
	const phoneIconRef = useRef<AnimatedIconHandle | null>(null);
	const [isUpdatingEditStatus, setIsUpdatingEditStatus] = useState(false);
	const [isUpdatingPaidRemainingBalance, setIsUpdatingPaidRemainingBalance] = useState(false);
	const [isUpdatingRemainingBalanceAmount, setIsUpdatingRemainingBalanceAmount] = useState(false);
	const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
	const customerBookingId = formatBookingInvoiceNumber(
		booking._id,
		booking.pendingPaymentCreatedAt,
	);
	const isConfirmedBooking = booking.status === "confirmed";
	const isPastBooking = !isUpcomingBooking(booking.date, booking.time);
	const canToggleStatus =
		isConfirmedBooking || booking.status === "failed" || booking.status === "email_failed";
	const nextStatus = isConfirmedBooking ? "failed" : "confirmed";
	const toggleStatusLabel = isConfirmedBooking ? "Mark as needs follow up" : "Mark as confirmed";
	const deliverableStatus = getDeliverableStatus(booking);
	const isPaidRemainingBalance = booking.paidRemainingBalance === true;
	const remainingBalanceAmount = getRemainingBalanceAmount(booking);
	const [deliverablesDriveLinkDraft, setDeliverablesDriveLinkDraft] = useState("");
	const [deliverablesEmailVariantDraft, setDeliverablesEmailVariantDraft] =
		useState<DeliverablesEmailVariant>("first-time");
	const [remainingBalanceDraft, setRemainingBalanceDraft] = useState(
		String(remainingBalanceAmount),
	);

	useEffect(() => {
		if (isRemainingBalanceDialogOpen) {
			setRemainingBalanceDraft(String(remainingBalanceAmount));
		}
	}, [isRemainingBalanceDialogOpen, remainingBalanceAmount]);

	async function handleDeleteBooking() {
		setIsDeleting(true);

		try {
			await deleteBooking({ bookingId: booking._id });
			setIsDeleteDialogOpen(false);
			toast.success("Booking deleted.");
		} catch (error) {
			toast.error(getDeleteBookingErrorMessage(error));
		} finally {
			setIsDeleting(false);
		}
	}

	async function handleEditBooking(values: BookingEditDraft) {
		setIsSaving(true);

		try {
			const parsedValues = bookingSchema.safeParse({
				name: values.name,
				phone: values.phone,
				accountName: values.accountName,
				abn: values.abn,
				email: values.email,
				date: values.date,
				time: values.time,
				duration: values.duration,
				service: values.service,
				addons: values.addons,
				essentialEditQuantity: values.essentialEditQuantity,
				clipsPackageQuantity: values.clipsPackageQuantity,
				notes: values.notes,
			});

			if (!parsedValues.success) {
				toast.error(parsedValues.error.issues[0]?.message ?? "Please check the booking details.");
				return;
			}

			await updateBooking({
				bookingId: booking._id,
				name: parsedValues.data.name,
				phone: parsedValues.data.phone,
				accountName: parsedValues.data.accountName,
				abn: parsedValues.data.abn,
				email: parsedValues.data.email,
				date: parsedValues.data.date,
				time: parsedValues.data.time,
				duration: parsedValues.data.duration,
				service: parsedValues.data.service,
				addons: parsedValues.data.addons,
				essentialEditQuantity: parsedValues.data.essentialEditQuantity || undefined,
				clipsPackageQuantity: parsedValues.data.clipsPackageQuantity || undefined,
				notes: parsedValues.data.notes || undefined,
			});
			setIsEditDialogOpen(false);
			toast.success("Booking updated.");
		} catch (error) {
			toast.error(getBookingMutationErrorMessage(error));
		} finally {
			setIsSaving(false);
		}
	}

	async function handleUpdateEditStatus(nextEditStatus: DeliverableStatus) {
		setIsUpdatingEditStatus(true);

		try {
			await updateBookingEditStatus({
				bookingId: booking._id,
				editStatus: nextEditStatus,
			});
			toast.success(
				`Deliverable status changed to ${deliverableStatusLabelMap[nextEditStatus].toLowerCase()}.`,
			);
		} catch {
			toast.error("Unable to update edit status.");
		} finally {
			setIsUpdatingEditStatus(false);
		}
	}

	async function handleSetPaidRemainingBalance(paidRemainingBalance: boolean) {
		setIsUpdatingPaidRemainingBalance(true);

		try {
			await updateBookingPaidRemainingBalance({
				bookingId: booking._id,
				paidRemainingBalance,
			});
			toast.success(
				paidRemainingBalance
					? "Remaining balance marked as paid."
					: "Remaining balance marked as unpaid.",
			);
		} catch {
			toast.error("Unable to update remaining balance payment status.");
		} finally {
			setIsUpdatingPaidRemainingBalance(false);
		}
	}

	async function handleSetRemainingBalanceAmount() {
		const parsedAmount = Number(remainingBalanceDraft);

		if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
			toast.error("Enter a valid remaining balance.");
			return;
		}

		setIsUpdatingRemainingBalanceAmount(true);

		try {
			await updateBookingRemainingBalanceAmount({
				bookingId: booking._id,
				remainingBalanceAmount: parsedAmount,
			});
			setIsRemainingBalanceDialogOpen(false);
			toast.success("Remaining balance updated.");
		} catch {
			toast.error("Unable to update remaining balance.");
		} finally {
			setIsUpdatingRemainingBalanceAmount(false);
		}
	}

	async function handleToggleStatus() {
		if (!canToggleStatus) {
			return;
		}

		setIsUpdatingStatus(true);

		try {
			await updateBookingStatus({
				bookingId: booking._id,
				status: nextStatus,
			});
			toast.success(
				nextStatus === "confirmed"
					? "Booking marked as confirmed."
					: "Booking marked as needs follow up.",
			);
		} catch (error) {
			toast.error(getBookingStatusMutationErrorMessage(error));
		} finally {
			setIsUpdatingStatus(false);
		}
	}

	async function handleDownloadInvoice() {
		setIsDownloadingInvoice(true);

		try {
			const result = await downloadAdminBookingInvoice({
				booking,
				createdAt: booking.pendingPaymentCreatedAt,
			});

			if (!result.success) {
				toast.error(result.message);
				return;
			}
			toast.success("Invoice download started.");
		} catch {
			toast.error("Unable to generate invoice.");
		} finally {
			setIsDownloadingInvoice(false);
		}
	}

	async function handleEmailInvoice() {
		setIsEmailingInvoice(true);

		try {
			await sendBookingInvoiceForBooking({
				bookingId: booking._id,
			});
			setIsEmailInvoiceDialogOpen(false);
			toast.success(`Invoice sent to ${booking.email}.`);
		} catch (error) {
			toast.error(getBookingInvoiceEmailErrorMessage(error));
		} finally {
			setIsEmailingInvoice(false);
		}
	}

	async function handleEmailDeliverables() {
		setIsEmailingDeliverables(true);

		try {
			await sendBookingDeliverablesEmailForBooking({
				bookingId: booking._id,
				driveLink: deliverablesDriveLinkDraft,
				emailVariant: deliverablesEmailVariantDraft,
			});
			await updateBookingEditStatus({
				bookingId: booking._id,
				editStatus: "completed",
			});
			setDeliverablesDriveLinkDraft("");
			setIsDeliverablesEmailDialogOpen(false);
			toast.success(`Deliverables email sent to ${booking.email}.`);
		} catch (error) {
			toast.error(getBookingDeliverablesEmailErrorMessage(error));
		} finally {
			setIsEmailingDeliverables(false);
		}
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
						<span className="sr-only">Open booking actions</span>
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
								className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
									className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
					{isConfirmedBooking ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuLabel className="text-muted-foreground text-sm">
								Payment status
							</DropdownMenuLabel>
							<div className="flex items-center gap-2 px-2 pb-2">
								<StatusCircleButton
									ariaLabel="Mark balance unpaid"
									className="bg-destructive"
									disabled={isUpdatingPaidRemainingBalance}
									isSelected={!isPaidRemainingBalance}
									onClick={() => {
										void handleSetPaidRemainingBalance(false);
									}}
								/>
								<StatusCircleButton
									ariaLabel="Mark balance paid"
									className="bg-green"
									disabled={isUpdatingPaidRemainingBalance}
									isSelected={isPaidRemainingBalance}
									onClick={() => {
										void handleSetPaidRemainingBalance(true);
									}}
								/>
							</div>
						</>
					) : null}
					<DropdownMenuSeparator />
					{isConfirmedBooking && isPastBooking ? (
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
										disabled={isUpdatingEditStatus}
										isSelected={deliverableStatus === option}
										onClick={() => {
											void handleUpdateEditStatus(option);
										}}
									/>
								))}
							</div>
							<DropdownMenuSeparator />
							<AnimatedDropdownMenuItem
								className="focus:text-green hover:text-green"
								disabled={isEmailingDeliverables}
								onSelect={() => setIsDeliverablesEmailDialogOpen(true)}
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
							{isConfirmedBooking ? (
								<>
									<AnimatedDropdownMenuItem
										onClick={() => navigator.clipboard.writeText(customerBookingId)}
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
										onClick={() => navigator.clipboard.writeText(String(booking._id))}
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
										disabled={isDownloadingInvoice}
										onSelect={handleDownloadInvoice}
										renderIcon={(iconRef) => (
											<DownloadIcon
												ref={iconRef}
												size={16}
												aria-hidden
												className="shrink-0 text-current"
											/>
										)}>
										{isDownloadingInvoice ? "Generating invoice..." : "Download invoice"}
									</AnimatedDropdownMenuItem>
									<AnimatedDropdownMenuItem
										disabled={isEmailingInvoice}
										onSelect={() => setIsEmailInvoiceDialogOpen(true)}
										renderIcon={(iconRef) => (
											<MailFilledIcon
												ref={iconRef}
												size={16}
												aria-hidden
												className="shrink-0 text-current"
											/>
										)}>
										Email invoice to customer
									</AnimatedDropdownMenuItem>
									<AnimatedDropdownMenuItem
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
									<AnimatedDropdownMenuItem
										onSelect={() => setIsRemainingBalanceDialogOpen(true)}
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
									onClick={() => navigator.clipboard.writeText(String(booking._id))}
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
							{canToggleStatus ? (
								<>
									<DropdownMenuSeparator />
									<AnimatedDropdownMenuItem
										className={
											isConfirmedBooking
												? "focus:text-destructive hover:text-destructive"
												: "focus:text-green hover:text-green"
										}
										disabled={isUpdatingStatus}
										onSelect={handleToggleStatus}
										renderIcon={(iconRef) => (
											<AmbulanceIcon
												ref={iconRef}
												size={16}
												aria-hidden
												className="shrink-0 text-current"
											/>
										)}>
										{toggleStatusLabel}
									</AnimatedDropdownMenuItem>
								</>
							) : null}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
					<DropdownMenuSeparator />
					<AnimatedDropdownMenuItem
						className="focus:text-destructive hover:text-destructive"
						onSelect={() => setIsEditDialogOpen(true)}
						renderIcon={(iconRef) => (
							<PenIcon
								ref={iconRef}
								size={16}
								aria-hidden
								className="shrink-0 text-current"
							/>
						)}>
						Edit booking
					</AnimatedDropdownMenuItem>
					<AnimatedDropdownMenuItem
						className="focus:text-destructive hover:text-destructive"
						onSelect={() => setIsDeleteDialogOpen(true)}
						renderIcon={(iconRef) => (
							<TrashIcon
								ref={iconRef}
								size={16}
								aria-hidden
								className="shrink-0 text-current"
							/>
						)}>
						Delete booking
					</AnimatedDropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<EmailInvoiceDialog
				open={isEmailInvoiceDialogOpen}
				bookingName={booking.name}
				bookingEmail={booking.email}
				isSending={isEmailingInvoice}
				onOpenChange={setIsEmailInvoiceDialogOpen}
				onSend={() => {
					void handleEmailInvoice();
				}}
			/>

			<DeliverablesEmailDialog
				open={isDeliverablesEmailDialogOpen}
				bookingEmail={booking.email}
				bookingId={booking._id}
				bookingName={booking.name}
				driveLink={deliverablesDriveLinkDraft}
				emailVariant={deliverablesEmailVariantDraft}
				isSending={isEmailingDeliverables}
				onDriveLinkChange={setDeliverablesDriveLinkDraft}
				onEmailVariantChange={setDeliverablesEmailVariantDraft}
				onOpenChange={setIsDeliverablesEmailDialogOpen}
				onSend={() => {
					void handleEmailDeliverables();
				}}
			/>

			<CustomInvoiceDialog
				open={isCustomInvoiceDialogOpen}
				booking={booking}
				onOpenChange={setIsCustomInvoiceDialogOpen}
			/>

			<RemainingBalanceDialog
				open={isRemainingBalanceDialogOpen}
				bookingId={booking._id}
				value={remainingBalanceDraft}
				defaultAmount={remainingBalanceAmount}
				isSaving={isUpdatingRemainingBalanceAmount}
				onOpenChange={setIsRemainingBalanceDialogOpen}
				onValueChange={setRemainingBalanceDraft}
				onSave={() => {
					void handleSetRemainingBalanceAmount();
				}}
			/>

			<BookingDeleteDialog
				open={isDeleteDialogOpen}
				bookingName={booking.name}
				bookingId={customerBookingId}
				sessionDate={booking.date}
				sessionTime={booking.time}
				onOpenChange={setIsDeleteDialogOpen}
				onConfirm={handleDeleteBooking}
				isDeleting={isDeleting}
			/>
			<BookingEditDialog
				open={isEditDialogOpen}
				booking={booking}
				bookingId={customerBookingId}
				onOpenChange={setIsEditDialogOpen}
				onSave={handleEditBooking}
				isSaving={isSaving}
			/>
		</>
	);
}
