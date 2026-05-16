import * as React from "react";
import { useAction, useMutation } from "convex/react";
import { LoaderCircle, MoreHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { bookingSchema } from "#studio/features/booking-form/lib/form-shared";
import { BookingDeleteDialog } from "#studio/features/admin/components/BookingDeleteDialog";
import {
	BookingEditDialog,
	type BookingEditDraft,
} from "#studio/features/admin/components/BookingEditDialog";
import { CustomInvoiceDialog } from "#studio/features/admin/components/CustomInvoiceDialog";
import {
	formatAudAmount,
	getRemainingBalanceAmount,
} from "#studio/features/admin/lib/remaining-balance";

type BookingRecord = Doc<"bookings">;

function stripInstagramHandlePrefix(instagramHandle: string) {
	return instagramHandle.trim().replace(/^@+/, "");
}

export type BookingActionsProps = {
	booking: BookingRecord;
};

export function BookingActions({ booking }: BookingActionsProps) {
	const deleteBooking = useMutation(api.bookings.deleteBooking);
	const sendBookingInvoiceForBooking = useAction(api.googleCalendar.sendBookingInvoiceForBooking);
	const updateBooking = useMutation(api.bookings.updateBooking);
	const updateBookingPaidRemainingBalance = useMutation(
		api.bookings.updateBookingPaidRemainingBalance,
	);
	const updateBookingRemainingBalanceAmount = useMutation(
		api.bookings.updateBookingRemainingBalanceAmount,
	);
	const updateBookingStatus = useMutation(api.bookings.updateBookingStatus);
	const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
	const [isEmailInvoiceDialogOpen, setIsEmailInvoiceDialogOpen] = React.useState(false);
	const [isCustomInvoiceDialogOpen, setIsCustomInvoiceDialogOpen] = React.useState(false);
	const [isRemainingBalanceDialogOpen, setIsRemainingBalanceDialogOpen] = React.useState(false);
	const [isDeleting, setIsDeleting] = React.useState(false);
	const [isEmailingInvoice, setIsEmailingInvoice] = React.useState(false);
	const [isSaving, setIsSaving] = React.useState(false);
	const [isDownloadingInvoice, setIsDownloadingInvoice] = React.useState(false);
	const [isUpdatingPaidRemainingBalance, setIsUpdatingPaidRemainingBalance] = React.useState(false);
	const [isUpdatingRemainingBalanceAmount, setIsUpdatingRemainingBalanceAmount] =
		React.useState(false);
	const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
	const customerBookingId = formatBookingInvoiceNumber(
		booking._id,
		booking.pendingPaymentCreatedAt,
	);
	const canTrackPaidRemainingBalance = booking.status === "confirmed";
	const canToggleStatus = booking.status === "confirmed" || booking.status === "failed";
	const nextStatus = booking.status === "confirmed" ? "failed" : "confirmed";
	const toggleStatusLabel =
		booking.status === "confirmed" ? "Mark as needs follow up" : "Mark as confirmed";
	const isPaidRemainingBalance = booking.paidRemainingBalance === true;
	const remainingBalanceAmount = getRemainingBalanceAmount(booking);
	const [remainingBalanceDraft, setRemainingBalanceDraft] = React.useState(
		String(remainingBalanceAmount),
	);
	const instagramHandle = booking.instagramHandle
		? stripInstagramHandlePrefix(booking.instagramHandle)
		: null;

	React.useEffect(() => {
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
			toast.success(getDeleteBookingErrorMessage(error));
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
				duration: booking.duration,
				service: values.service,
				addons: values.addons,
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
				service: parsedValues.data.service,
				addons: parsedValues.data.addons,
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

	async function handleTogglePaidRemainingBalance() {
		setIsUpdatingPaidRemainingBalance(true);

		try {
			await updateBookingPaidRemainingBalance({
				bookingId: booking._id,
				paidRemainingBalance: !isPaidRemainingBalance,
			});
			toast.success(
				!isPaidRemainingBalance
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
			const { downloadBookingInvoicePdf } =
				await import("#studio/features/booking-invoice/pdf/download-booking-invoice-pdf");
			const parsedBooking = bookingSchema.safeParse({
				name: booking.name,
				phone: booking.phone,
				accountName: booking.accountName,
				abn: booking.abn,
				email: booking.email,
				date: booking.date,
				time: booking.time,
				duration: booking.duration,
				service: booking.service,
				addons: booking.addons,
				notes: booking.notes ?? "",
			});

			if (!parsedBooking.success) {
				toast.error(parsedBooking.error.issues[0]?.message ?? "Unable to generate invoice.");
				return;
			}

			await downloadBookingInvoicePdf({
				bookingId: booking._id,
				name: parsedBooking.data.name,
				phone: parsedBooking.data.phone,
				accountName: parsedBooking.data.accountName,
				abn: parsedBooking.data.abn,
				email: parsedBooking.data.email,
				date: parsedBooking.data.date,
				time: parsedBooking.data.time,
				duration: parsedBooking.data.duration,
				service: parsedBooking.data.service,
				addons: parsedBooking.data.addons,
				createdAt: booking.pendingPaymentCreatedAt,
			});
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

	return (
		<>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						className="touch-manipulation">
						<span className="sr-only">Open booking actions</span>
						<MoreHorizontal />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					className="w-56 touch-manipulation">
					<DropdownMenuGroup>
						{booking.abn ? (
							<DropdownMenuItem onClick={() => navigator.clipboard.writeText(booking.abn ?? "")}>
								Copy ABN
							</DropdownMenuItem>
						) : null}
						{instagramHandle ? (
							<DropdownMenuItem onClick={() => navigator.clipboard.writeText(instagramHandle)}>
								Copy Instagram handle
							</DropdownMenuItem>
						) : null}
						<DropdownMenuItem onClick={() => navigator.clipboard.writeText(String(booking._id))}>
							Copy database ID
						</DropdownMenuItem>
						<DropdownMenuItem onClick={() => navigator.clipboard.writeText(customerBookingId)}>
							Copy booking ID
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuItem asChild>
							<a href={`mailto:${booking.email}`}>Email customer</a>
						</DropdownMenuItem>
						{booking.phone ? (
							<DropdownMenuItem asChild>
								<a href={`tel:${booking.phone}`}>Call customer</a>
							</DropdownMenuItem>
						) : null}
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						disabled={isDownloadingInvoice}
						onSelect={handleDownloadInvoice}>
						{isDownloadingInvoice ? "Generating invoice..." : "Download invoice"}
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={isEmailingInvoice}
						onSelect={() => setIsEmailInvoiceDialogOpen(true)}>
						Email invoice to customer
					</DropdownMenuItem>
					<DropdownMenuItem onSelect={() => setIsCustomInvoiceDialogOpen(true)}>
						Custom invoice
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					{canTrackPaidRemainingBalance ? (
						<>
							<DropdownMenuItem
								disabled={isUpdatingPaidRemainingBalance}
								onSelect={handleTogglePaidRemainingBalance}>
								{isPaidRemainingBalance ? "Mark balance unpaid" : "Mark balance paid"}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => setIsRemainingBalanceDialogOpen(true)}>
								Set remaining balance
							</DropdownMenuItem>
						</>
					) : null}
					{canToggleStatus ? (
						<>
							<DropdownMenuItem
								disabled={isUpdatingStatus}
								onSelect={handleToggleStatus}>
								{toggleStatusLabel}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
						</>
					) : null}
					<DropdownMenuItem
						className="text-destructive focus:text-destructive"
						onSelect={() => setIsEditDialogOpen(true)}>
						Edit booking
					</DropdownMenuItem>
					<DropdownMenuItem
						className="text-destructive focus:text-destructive"
						onSelect={() => setIsDeleteDialogOpen(true)}>
						Delete booking
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog
				open={isEmailInvoiceDialogOpen}
				onOpenChange={(nextOpen) => {
					if (isEmailingInvoice && !nextOpen) {
						return;
					}

					setIsEmailInvoiceDialogOpen(nextOpen);
				}}>
				<DialogContent
					className="sm:max-w-lg"
					onInteractOutside={(event) => {
						if (isEmailingInvoice) {
							event.preventDefault();
						}
					}}
					onEscapeKeyDown={(event) => {
						if (isEmailingInvoice) {
							event.preventDefault();
						}
					}}>
					<DialogClose asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="absolute top-2 right-2"
							aria-label="Close email invoice dialog"
							disabled={isEmailingInvoice}>
							<X />
						</Button>
					</DialogClose>

					<DialogHeader className="text-left">
						<DialogTitle>Email invoice to customer?</DialogTitle>
						<DialogDescription>
							Confirm before sending the invoice email to this customer.
						</DialogDescription>
					</DialogHeader>

					<div className="rounded-lg border bg-muted/40 p-4">
						<dl className="grid gap-3 text-sm sm:grid-cols-2">
							<div className="grid gap-1">
								<dt className="text-muted-foreground">Customer</dt>
								<dd className="font-medium">{booking.name}</dd>
							</div>
							<div className="grid gap-1">
								<dt className="text-muted-foreground">Email</dt>
								<dd className="break-all font-medium">{booking.email}</dd>
							</div>
						</dl>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsEmailInvoiceDialogOpen(false)}
							disabled={isEmailingInvoice}>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={() => {
								void handleEmailInvoice();
							}}
							disabled={isEmailingInvoice}>
							{isEmailingInvoice ? <LoaderCircle className="size-4 animate-spin" /> : null}
							{isEmailingInvoice ? "Sending..." : "Email invoice"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<CustomInvoiceDialog
				open={isCustomInvoiceDialogOpen}
				booking={booking}
				onOpenChange={setIsCustomInvoiceDialogOpen}
			/>

			<Dialog
				open={isRemainingBalanceDialogOpen}
				onOpenChange={setIsRemainingBalanceDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Set remaining balance</DialogTitle>
						<DialogDescription>
							This value shows in the Paid column until the balance is marked paid.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-2">
						<Label htmlFor={`remaining-balance-${booking._id}`}>Remaining balance</Label>
						<Input
							id={`remaining-balance-${booking._id}`}
							type="number"
							min="0"
							step="0.01"
							value={remainingBalanceDraft}
							onChange={(event) => setRemainingBalanceDraft(event.target.value)}
						/>
						<p className="text-sm text-muted-foreground">
							Current default: {formatAudAmount(remainingBalanceAmount)}
						</p>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setIsRemainingBalanceDialogOpen(false)}
							disabled={isUpdatingRemainingBalanceAmount}>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={() => {
								void handleSetRemainingBalanceAmount();
							}}
							disabled={isUpdatingRemainingBalanceAmount}>
							{isUpdatingRemainingBalanceAmount ? "Saving..." : "Save balance"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

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

function getDeleteBookingErrorMessage(error: unknown) {
	if (typeof error !== "object" || error === null) {
		return "Unable to delete booking.";
	}

	const code = "data" in error ? (error as { data?: { code?: string } }).data?.code : undefined;

	switch (code) {
		case "NOT_AUTHENTICATED":
			return "You are not signed in.";
		case "BOOKING_NOT_FOUND":
			return "That booking no longer exists.";
		default:
			return "Unable to delete booking.";
	}
}

function getBookingMutationErrorMessage(error: unknown) {
	if (typeof error !== "object" || error === null) {
		return "Unable to save booking changes.";
	}

	const code = "data" in error ? (error as { data?: { code?: string } }).data?.code : undefined;

	switch (code) {
		case "NOT_AUTHENTICATED":
			return "You are not signed in.";
		case "BOOKING_NOT_FOUND":
			return "That booking no longer exists.";
		default:
			return "Unable to save booking changes.";
	}
}

function getBookingStatusMutationErrorMessage(error: unknown) {
	if (typeof error !== "object" || error === null) {
		return "Unable to update booking status.";
	}

	const code = "data" in error ? (error as { data?: { code?: string } }).data?.code : undefined;

	switch (code) {
		case "NOT_AUTHENTICATED":
			return "You are not signed in.";
		case "BOOKING_NOT_FOUND":
			return "That booking no longer exists.";
		case "INVALID_BOOKING_STATUS_TRANSITION":
			return "Only confirmed and needs follow up bookings can be toggled here.";
		default:
			return "Unable to update booking status.";
	}
}

function getBookingInvoiceEmailErrorMessage(error: unknown) {
	if (typeof error !== "object" || error === null) {
		return "Unable to send invoice email.";
	}

	const code = "data" in error ? (error as { data?: { code?: string } }).data?.code : undefined;

	switch (code) {
		case "NOT_AUTHENTICATED":
			return "You are not signed in.";
		case "BOOKING_NOT_FOUND":
			return "That booking no longer exists.";
		case "INVALID_BOOKING_DATA":
			return "This booking has invalid invoice data.";
		default:
			return "Unable to send invoice email.";
	}
}
