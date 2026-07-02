import { LoaderCircle } from "lucide-react";

import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";

export function PackagePaymentConfirmationDialog({
	isConfirming,
	onConfirm,
	onOpenChange,
	open,
	packageRow
}: {
	isConfirming: boolean;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	packageRow: AdminPackageRow;
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Confirm payment for {packageRow.customerName}</DialogTitle>
					<DialogDescription>
						This will mark the package as paid and send the customer their private scheduling link.
					</DialogDescription>
				</DialogHeader>

				<div className="rounded-lg border bg-muted p-4">
					<p className="text-sm text-muted-foreground">Package total</p>
					<p className="text-2xl font-semibold text-foreground">{packageRow.totalDueLabel}</p>
					<p className="mt-2 text-sm text-muted-foreground">
						{packageRow.packageSize} sessions for {packageRow.customerEmail}
					</p>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						disabled={isConfirming}
						onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={isConfirming}
						onClick={onConfirm}>
						{isConfirming ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{isConfirming ? "Confirming..." : "Confirm payment"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
