import { LoaderCircle, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { formatBookingDateMedium, formatBookingTimeLabel } from "#studio/lib/bookingdatetime";

export type SessionCancelBookingDialogProps = {
	open: boolean;
	bookingName: string;
	bookingId: string;
	sessionDate: string;
	sessionTime: string;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => Promise<void>;
	isCancelling: boolean;
};

export function SessionCancelBookingDialog({
	open,
	bookingName,
	bookingId,
	sessionDate,
	sessionTime,
	onOpenChange,
	onConfirm,
	isCancelling
}: SessionCancelBookingDialogProps) {
	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (isCancelling && !nextOpen) {
					return;
				}

				onOpenChange(nextOpen);
			}}>
			<DialogContent
				className="sm:max-w-lg"
				onInteractOutside={(event) => {
					if (isCancelling) {
						event.preventDefault();
					}
				}}
				onEscapeKeyDown={(event) => {
					if (isCancelling) {
						event.preventDefault();
					}
				}}>
				<DialogClose asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute top-2 right-2"
						aria-label="Close cancel booking dialog"
						disabled={isCancelling}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="text-left">
					<DialogTitle>Cancel booking?</DialogTitle>
					<DialogDescription>
						This removes the Google Calendar event and marks the booking as cancelled. The session
						is archived automatically and remains on All sessions.
					</DialogDescription>
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
							<dt className="text-muted-foreground">Session ID</dt>
							<dd className="font-medium">{bookingId}</dd>
						</div>
					</dl>
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isCancelling}>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={() => {
							void onConfirm();
						}}
						disabled={isCancelling}>
						{isCancelling ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{isCancelling ? "Cancelling" : "Cancel booking"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
