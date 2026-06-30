import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import type { StaleCleanupBookingCounts } from "#studio/features/admin/lib/admin-sessions";

type CleanupOldBookingsDialogProps = {
	isCleaningUp: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	staleCleanupBookingsCount: number;
	staleCounts: StaleCleanupBookingCounts;
};

export function CleanupOldBookingsDialog({
	isCleaningUp,
	onConfirm,
	onOpenChange,
	open,
	staleCleanupBookingsCount,
	staleCounts
}: CleanupOldBookingsDialogProps) {
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Clean up unconfirmed bookings?</DialogTitle>
					<DialogDescription>
						This will permanently delete unconfirmed booking records from the database.
					</DialogDescription>
				</DialogHeader>

				<div className="rounded-lg border bg-muted/40 p-3 text-sm">
					<p className="font-medium">{staleCleanupBookingsCount} bookings will be deleted</p>
					<ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
						<li>{staleCounts.expired} expired bookings</li>
						<li>{staleCounts.abandoned} abandoned bookings</li>
						<li>{staleCounts.pending_payment} pending bookings older than 24 hours</li>
					</ul>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isCleaningUp}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={onConfirm}
						disabled={isCleaningUp || staleCleanupBookingsCount === 0}>
						{isCleaningUp ? "Deleting..." : "Delete unconfirmed bookings"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
