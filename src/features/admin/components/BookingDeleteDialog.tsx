import { X } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { formatBookingDateMedium, formatBookingTimeLabel } from "#/lib/bookingdatetime";

export type BookingDeleteDialogProps = {
	open: boolean;
	bookingName: string;
	bookingId: string;
	sessionDate: string;
	sessionTime: string;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => Promise<void>;
	isDeleting: boolean;
};

export function BookingDeleteDialog({
	open,
	bookingName,
	bookingId,
	sessionDate,
	sessionTime,
	onOpenChange,
	onConfirm,
	isDeleting,
}: BookingDeleteDialogProps) {
	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (isDeleting && !nextOpen) {
					return;
				}

				onOpenChange(nextOpen);
			}}>
			<DialogContent
				className="sm:max-w-lg"
				onInteractOutside={(event) => {
					if (isDeleting) {
						event.preventDefault();
					}
				}}
				onEscapeKeyDown={(event) => {
					if (isDeleting) {
						event.preventDefault();
					}
				}}>
				<DialogClose asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute top-2 right-2"
						aria-label="Close delete booking dialog"
						disabled={isDeleting}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="text-left">
					<DialogTitle>Permanently delete booking?</DialogTitle>
					<DialogDescription>There is no turning back from this. USE CAUTION.</DialogDescription>
				</DialogHeader>

				<div className="rounded-lg border bg-muted/40 p-4">
					<dl className="grid gap-3 text-sm sm:grid-cols-2">
						<div className="grid gap-1">
							<dt className="text-muted-foreground">Customer</dt>
							<dd className="font-medium">{bookingName}</dd>
						</div>
						<div className="grid gap-1">
							<dt className="text-muted-foreground">Session</dt>
							<dd className="font-medium">
								{formatBookingDateMedium(sessionDate)} at {formatBookingTimeLabel(sessionTime)}
							</dd>
						</div>
						<div className="grid gap-1 sm:col-span-2">
							<dt className="text-muted-foreground">Booking ID</dt>
							<dd className="font-medium">{bookingId}</dd>
						</div>
					</dl>
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isDeleting}>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={() => {
							void onConfirm();
						}}
						disabled={isDeleting}>
						{isDeleting ? "Deleting..." : "I am sure I want to permanently delete this booking"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
