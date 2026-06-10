import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";

type ChangedFieldListProps = {
	fields: string[];
	title: string;
};

export type BookingEditConfirmationDialogProps = {
	open: boolean;
	googleEventFieldLabels: string[];
	isSaving: boolean;
	pricingFieldLabels: string[];
	onCancel: () => void;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
};

function ChangedFieldList({ fields, title }: ChangedFieldListProps) {
	if (fields.length === 0) {
		return null;
	}

	return (
		<section className="grid gap-2 rounded-lg border bg-muted/30 p-3">
			<h3 className="font-medium text-sm">{title}</h3>
			<ul className="list-disc space-y-1 pl-5 text-muted-foreground text-sm">
				{fields.map((field) => (
					<li key={field}>{field}</li>
				))}
			</ul>
		</section>
	);
}

export function BookingEditConfirmationDialog({
	open,
	googleEventFieldLabels,
	isSaving,
	pricingFieldLabels,
	onCancel,
	onConfirm,
	onOpenChange,
}: BookingEditConfirmationDialogProps) {
	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (isSaving && !nextOpen) {
					return;
				}

				onOpenChange(nextOpen);
			}}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Confirm booking changes</DialogTitle>
					<DialogDescription>
						Review what this save will affect before making the booking changes permanent.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3">
					<ChangedFieldList
						title="Google Calendar event will update"
						fields={googleEventFieldLabels}
					/>
					<ChangedFieldList
						title="Pricing or remaining balance may recalculate"
						fields={pricingFieldLabels}
					/>
					<p className="text-muted-foreground text-sm">
						If a new invoice email is needed, send it manually after saving.
					</p>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled={isSaving}
						onClick={onCancel}>
						Cancel
					</Button>
					<Button
						type="button"
						disabled={isSaving}
						onClick={onConfirm}>
						{isSaving ? "Saving..." : "Save changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
