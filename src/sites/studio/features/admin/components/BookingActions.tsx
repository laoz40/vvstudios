import {
	useEffect,
	useRef,
	useState,
	type ComponentProps,
	type ReactNode,
	type RefObject
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
import { tryCatch } from "#/lib/result";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import {
	type DownloadAdminBookingInvoiceResult,
	downloadAdminBookingInvoice
} from "#studio/features/admin/lib/download-admin-booking-invoice";
import { bookingSchema } from "#studio/features/booking-form/lib/form-shared";
import { BookingDeleteDialog } from "#studio/features/admin/components/BookingDeleteDialog";
import {
	BookingEditDialog,
	type BookingEditDraft
} from "#studio/features/admin/components/BookingEditDialog";
import { BookingEditConfirmationDialog } from "#studio/features/admin/components/BookingEditConfirmationDialog";
import { CustomInvoiceDialog } from "#studio/features/admin/components/CustomInvoiceDialog";
import { EmailInvoiceDialog } from "#studio/features/admin/components/EmailInvoiceDialog";
import { DeliverablesEmailDialog } from "#studio/features/admin/components/DeliverablesEmailDialog";
import { RemainingBalanceDialog } from "#studio/features/admin/components/RemainingBalanceDialog";
import {
	EDIT_STATUS_OPTIONS,
	deliverableStatusDotClassNameMap,
	deliverableStatusLabelMap,
	getDeliverableStatus,
	type DeliverableStatus
} from "#studio/features/admin/lib/booking-edit-status";
import type { SendBookingDeliverablesEmailResult } from "#convex/deliverablesEmail";
import type { DeliverablesEmailVariant } from "#studio/features/deliverables-email/lib/constants";
import { getBookingEditWarningState } from "#studio/features/admin/lib/booking-edit-warnings";
import { getRemainingBalanceAmount } from "#studio/features/admin/lib/remaining-balance";
import { isUpcomingBooking } from "#studio/lib/bookingdatetime";
import type {
	DeleteBookingFromAdminResult,
	SendBookingInvoiceForBookingResult,
	UpdateBookingFromAdminResult
} from "#convex/googleCalendar";
import type {
	UpdateBookingEditStatusResult,
	UpdateBookingPaidRemainingBalanceResult,
	UpdateBookingRemainingBalanceAmountResult,
	UpdateBookingStatusResult
} from "#convex/bookings";

type BookingRecord = Doc<"bookings">;

export type BookingActionsProps = { booking: BookingRecord };

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
	onClick
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
				isSelected && "ring-2 ring-accent-foreground ring-offset-2 ring-offset-popover"
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
	const deleteBooking = useAction(api.googleCalendar.deleteBookingFromAdmin);
	const sendBookingDeliverablesEmail = useAction(
		api.deliverablesEmail.sendBookingDeliverablesEmail
	);
	const sendBookingInvoiceForBooking = useAction(api.googleCalendar.sendBookingInvoiceForBooking);
	const updateBooking = useAction(api.googleCalendar.updateBookingFromAdmin);
	const updateBookingEditStatus = useMutation(api.bookings.updateBookingEditStatus);
	const updateBookingPaidRemainingBalance = useMutation(
		api.bookings.updateBookingPaidRemainingBalance
	);
	const updateBookingRemainingBalanceAmount = useMutation(
		api.bookings.updateBookingRemainingBalanceAmount
	);
	const updateBookingStatus = useMutation(api.bookings.updateBookingStatus);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isReplacementEventDialogOpen, setIsReplacementEventDialogOpen] = useState(false);
	const [isEditConfirmationDialogOpen, setIsEditConfirmationDialogOpen] = useState(false);
	const [pendingEditDraft, setPendingEditDraft] = useState<BookingEditDraft | null>(null);
	const [pendingEditWarningState, setPendingEditWarningState] = useState<ReturnType<
		typeof getBookingEditWarningState
	> | null>(null);
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
		booking.pendingPaymentCreatedAt
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
		String(remainingBalanceAmount)
	);

	useEffect(() => {
		if (isRemainingBalanceDialogOpen) {
			setRemainingBalanceDraft(String(remainingBalanceAmount));
		}
	}, [isRemainingBalanceDialogOpen, remainingBalanceAmount]);

	async function handleDeleteBooking() {
		setIsDeleting(true);

		const [error] = await tryCatch<DeleteBookingFromAdminResult>(
			deleteBooking({ bookingId: booking._id })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to delete bookings.");
					break;

				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;

				case "GOOGLE_CALENDAR_EVENT_NOT_FOUND":
					toast.error("Could not find the Google Calendar event. Booking was not deleted.");
					break;

				case "GOOGLE_CALENDAR_AUTH_FAILED":
					toast.error("Google Calendar authentication failed. Booking was not deleted.");
					break;

				case "BOOKING_DELETE_FAILED":
					toast.error("Could not delete the booking. Please try again.");
					break;

				case "GOOGLE_CALENDAR_DELETE_FAILED":
					toast.error("Google Calendar failed to delete the event. Please try again.");
					break;

				case "GOOGLE_CALENDAR_RATE_LIMITED":
					toast.error("Google Calendar is busy right now. Wait a minute, then try deleting again.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while deleting the booking. Please try again.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsDeleting(false);
			return;
		}

		setIsDeleteDialogOpen(false);
		toast.success("Booking deleted.");
		setIsDeleting(false);
	}

	async function saveEditBooking(
		values: BookingEditDraft,
		options?: { skipConfirmation?: boolean }
	) {
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
			notes: values.notes
		});

		if (!parsedValues.success) {
			toast.error(parsedValues.error.issues[0]?.message ?? "Please check the booking details.");
			return;
		}

		if (!options?.skipConfirmation) {
			const warningState = getBookingEditWarningState(booking, values);

			if (warningState.requiresConfirmation) {
				setPendingEditDraft(values);
				setPendingEditWarningState(warningState);
				setIsEditConfirmationDialogOpen(true);
				return;
			}
		}

		setIsSaving(true);

		const [error, result] = await tryCatch<UpdateBookingFromAdminResult>(
			updateBooking({
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
				notes: parsedValues.data.notes || undefined
			})
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to update bookings.");
					break;

				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;

				case "BOOKING_TIME_UNAVAILABLE":
					toast.error("That time is no longer available. Choose another time.");
					break;

				case "GOOGLE_CALENDAR_AUTH_FAILED":
					toast.error("Google Calendar authentication failed. Booking was not updated.");
					break;

				case "GOOGLE_CALENDAR_CREATE_FAILED":
					toast.error("Google Calendar failed to create the event. Please try again.");
					break;

				case "GOOGLE_CALENDAR_UPDATE_FAILED":
					toast.error("Google Calendar failed to update the event. Please try again.");
					break;

				case "GOOGLE_CALENDAR_RATE_LIMITED":
					toast.error("Google Calendar is busy right now. Wait a minute, then try again.");
					break;

				case "GOOGLE_CALENDAR_AVAILABILITY_FAILED":
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while updating the booking. Please try again.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsSaving(false);
			return;
		}

		if (result.googleOutcome === "replacementCreated") {
			setIsEditDialogOpen(false);
			setIsReplacementEventDialogOpen(true);
			toast.success("Booking updated. Replacement Calendar event created.");
			setIsSaving(false);
			return;
		}

		setIsEditDialogOpen(false);
		toast.success("Booking updated.");
		setIsSaving(false);
	}

	async function handleEditBooking(values: BookingEditDraft) {
		await saveEditBooking(values);
	}

	function closeEditConfirmationDialog() {
		setPendingEditDraft(null);
		setPendingEditWarningState(null);
		setIsEditConfirmationDialogOpen(false);
	}

	async function handleConfirmEditBooking() {
		if (!pendingEditDraft) {
			closeEditConfirmationDialog();
			return;
		}

		const draftToSave = pendingEditDraft;
		setIsEditConfirmationDialogOpen(false);
		await saveEditBooking(draftToSave, { skipConfirmation: true });
		setPendingEditWarningState(null);
		setPendingEditDraft(null);
	}

	async function handleUpdateEditStatus(nextEditStatus: DeliverableStatus) {
		setIsUpdatingEditStatus(true);

		const [error] = await tryCatch<UpdateBookingEditStatusResult>(
			updateBookingEditStatus({ bookingId: booking._id, editStatus: nextEditStatus })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to update bookings.");
					break;

				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;

				case "BOOKING_EDIT_STATUS_UPDATE_FAILED":
					toast.error("Could not update the deliverables status. Please try again.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while updating the deliverables status.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsUpdatingEditStatus(false);
			return;
		}

		toast.success(
			`Deliverable status changed to ${deliverableStatusLabelMap[nextEditStatus].toLowerCase()}.`
		);
		setIsUpdatingEditStatus(false);
	}

	async function handleSetPaidRemainingBalance(paidRemainingBalance: boolean) {
		setIsUpdatingPaidRemainingBalance(true);

		const [error] = await tryCatch<UpdateBookingPaidRemainingBalanceResult>(
			updateBookingPaidRemainingBalance({ bookingId: booking._id, paidRemainingBalance })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to update bookings.");
					break;

				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;

				case "BOOKING_PAID_REMAINING_BALANCE_UPDATE_FAILED":
					toast.error("Could not update the payment status. Please try again.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while updating the payment status.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsUpdatingPaidRemainingBalance(false);
			return;
		}

		toast.success(
			paidRemainingBalance
				? "Remaining balance marked as paid."
				: "Remaining balance marked as unpaid."
		);
		setIsUpdatingPaidRemainingBalance(false);
	}

	async function handleSetRemainingBalanceAmount() {
		const parsedAmount = Number(remainingBalanceDraft);

		if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
			toast.error("Enter a valid remaining balance.");
			return;
		}

		setIsUpdatingRemainingBalanceAmount(true);

		const [error] = await tryCatch<UpdateBookingRemainingBalanceAmountResult>(
			updateBookingRemainingBalanceAmount({
				bookingId: booking._id,
				remainingBalanceAmount: parsedAmount
			})
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to update bookings.");
					break;

				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;

				case "BOOKING_REMAINING_BALANCE_AMOUNT_UPDATE_FAILED":
					toast.error("Could not update the remaining balance. Please try again.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while updating the remaining balance.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsUpdatingRemainingBalanceAmount(false);
			return;
		}

		setIsRemainingBalanceDialogOpen(false);
		toast.success("Remaining balance updated.");
		setIsUpdatingRemainingBalanceAmount(false);
	}

	async function handleToggleStatus() {
		if (!canToggleStatus) {
			return;
		}

		setIsUpdatingStatus(true);

		const [error] = await tryCatch<UpdateBookingStatusResult>(
			updateBookingStatus({ bookingId: booking._id, status: nextStatus })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to update bookings.");
					break;

				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;

				case "INVALID_BOOKING_STATUS_TRANSITION":
					toast.error("This booking status cannot be changed here.");
					break;

				case "BOOKING_STATUS_UPDATE_FAILED":
					toast.error("Could not update the booking status. Please try again.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while updating the booking status.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsUpdatingStatus(false);
			return;
		}

		toast.success(
			nextStatus === "confirmed"
				? "Booking marked as confirmed."
				: "Booking marked as needs follow up."
		);
		setIsUpdatingStatus(false);
	}

	async function handleDownloadInvoice() {
		setIsDownloadingInvoice(true);

		const [error] = await tryCatch<DownloadAdminBookingInvoiceResult>(
			downloadAdminBookingInvoice({ booking, createdAt: booking.pendingPaymentCreatedAt })
		);

		if (error !== null) {
			switch (error.reason) {
				case "INVALID_INVOICE_INPUT":
					toast.error(error.message);
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Unable to generate invoice.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsDownloadingInvoice(false);
			return;
		}

		toast.success("Invoice download started.");
		setIsDownloadingInvoice(false);
	}

	async function handleEmailInvoice() {
		setIsEmailingInvoice(true);

		const [error] = await tryCatch<SendBookingInvoiceForBookingResult>(
			sendBookingInvoiceForBooking({ bookingId: booking._id })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to send invoice emails.");
					break;

				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;

				case "INVOICE_SEND_FAILED":
					toast.error("Unable to send invoice email.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while sending the invoice email.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsEmailingInvoice(false);
			return;
		}

		setIsEmailInvoiceDialogOpen(false);
		toast.success(`Invoice sent to ${booking.email}.`);
		setIsEmailingInvoice(false);
	}

	async function handleEmailDeliverables() {
		setIsEmailingDeliverables(true);

		const [emailError] = await tryCatch<SendBookingDeliverablesEmailResult>(
			sendBookingDeliverablesEmail({
				bookingId: booking._id,
				driveLink: deliverablesDriveLinkDraft,
				emailVariant: deliverablesEmailVariantDraft
			})
		);

		if (emailError !== null) {
			switch (emailError.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to send deliverables emails.");
					break;

				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;

				case "INVALID_DRIVE_LINK":
					toast.error("Enter a valid Google Drive link.");
					break;

				case "DELIVERABLES_SEND_FAILED":
					toast.error("Unable to send deliverables email.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while sending the deliverables email.");
					break;

				default: {
					const _exhaustive: never = emailError;
					return _exhaustive;
				}
			}

			setIsEmailingDeliverables(false);
			return;
		}

		const [statusError] = await tryCatch<UpdateBookingEditStatusResult>(
			updateBookingEditStatus({ bookingId: booking._id, editStatus: "completed" })
		);

		if (statusError !== null) {
			switch (statusError.reason) {
				case "NOT_AUTHENTICATED":
					toast.error(
						"Deliverables email sent, but you need to sign in again to update the status."
					);
					break;

				case "NOT_AUTHORIZED":
					toast.error("Deliverables email sent, but you do not have access to update the status.");
					break;

				case "BOOKING_NOT_FOUND":
					toast.error(
						"Deliverables email sent, but the booking could not be found in the database."
					);
					break;

				case "BOOKING_EDIT_STATUS_UPDATE_FAILED":
					toast.error("Deliverables email sent, but the status could not be updated.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Deliverables email sent, but something went wrong updating the status.");
					break;

				default: {
					const _exhaustive: never = statusError;
					return _exhaustive;
				}
			}

			setIsEmailingDeliverables(false);
			return;
		}

		setDeliverablesDriveLinkDraft("");
		setIsDeliverablesEmailDialogOpen(false);
		toast.success(`Deliverables email sent to ${booking.email}.`);
		setIsEmailingDeliverables(false);
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

			<BookingEditConfirmationDialog
				open={isEditConfirmationDialogOpen}
				isSaving={isSaving}
				googleEventFieldLabels={pendingEditWarningState?.googleEventFieldLabels ?? []}
				onCancel={closeEditConfirmationDialog}
				pricingFieldLabels={pendingEditWarningState?.pricingFieldLabels ?? []}
				onConfirm={() => {
					void handleConfirmEditBooking();
				}}
				onOpenChange={(nextOpen) => {
					setIsEditConfirmationDialogOpen(nextOpen);
					if (!nextOpen) {
						setPendingEditDraft(null);
						setPendingEditWarningState(null);
					}
				}}
			/>

			<Dialog
				open={isReplacementEventDialogOpen}
				onOpenChange={setIsReplacementEventDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Google Calendar event repaired</DialogTitle>
						<DialogDescription>
							The old Google Calendar event was missing or deleted, so a replacement event was
							created and linked to this booking.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							type="button"
							onClick={() => setIsReplacementEventDialogOpen(false)}>
							OK
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
