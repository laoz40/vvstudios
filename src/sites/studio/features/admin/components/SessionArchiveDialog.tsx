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

export type SessionArchiveDialogProps = {
	open: boolean;
	bookingName: string;
	bookingId: string;
	sessionDate: string;
	sessionTime: string;
	editorDisplayName: string | null;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => Promise<void>;
	isArchiving: boolean;
};

export function SessionArchiveDialog({
	open,
	bookingName,
	bookingId,
	sessionDate,
	sessionTime,
	editorDisplayName,
	onOpenChange,
	onConfirm,
	isArchiving
}: SessionArchiveDialogProps) {
	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (isArchiving && !nextOpen) {
					return;
				}

				onOpenChange(nextOpen);
			}}>
			<DialogContent
				className="sm:max-w-lg"
				onInteractOutside={(event) => {
					if (isArchiving) {
						event.preventDefault();
					}
				}}
				onEscapeKeyDown={(event) => {
					if (isArchiving) {
						event.preventDefault();
					}
				}}>
				<DialogClose asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute top-2 right-2"
						aria-label="Close archive session dialog"
						disabled={isArchiving}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="text-left">
					<DialogTitle>Archive session?</DialogTitle>
					<DialogDescription>
						Archiving only hides this session from the Inbox tab. It stays on the editor dashboard
						{editorDisplayName ? ` for ${editorDisplayName}` : ""} until you cancel the session or
						mark deliverables as sent.
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
						disabled={isArchiving}>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={() => {
							void onConfirm();
						}}
						disabled={isArchiving}>
						{isArchiving ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{isArchiving ? "Archiving" : "Archive session"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
