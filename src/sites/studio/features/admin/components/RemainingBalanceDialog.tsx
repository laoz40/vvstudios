import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { formatAudAmount } from "#studio/features/admin/lib/remaining-balance";

export type RemainingBalanceDialogProps = {
	open: boolean;
	bookingId: string;
	value: string;
	defaultAmount: number;
	isSaving: boolean;
	onOpenChange: (open: boolean) => void;
	onValueChange: (value: string) => void;
	onSave: () => void;
};

export function RemainingBalanceDialog({
	open,
	bookingId,
	value,
	defaultAmount,
	isSaving,
	onOpenChange,
	onValueChange,
	onSave,
}: RemainingBalanceDialogProps) {
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Set remaining balance</DialogTitle>
					<DialogDescription>
						This value shows in the Paid column until the balance is marked paid.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<Label htmlFor={`remaining-balance-${bookingId}`}>Remaining balance</Label>
					<Input
						id={`remaining-balance-${bookingId}`}
						type="number"
						min="0"
						step="0.01"
						value={value}
						onChange={(event) => onValueChange(event.target.value)}
					/>
					<p className="text-sm text-muted-foreground">
						Current default: {formatAudAmount(defaultAmount)}
					</p>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSaving}>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={onSave}
						disabled={isSaving}>
						{isSaving ? "Saving..." : "Save balance"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
