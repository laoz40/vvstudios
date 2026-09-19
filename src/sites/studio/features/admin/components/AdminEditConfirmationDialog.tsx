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

type ChangedFieldListProps = { fields: string[]; title: string; description?: string };

const EMPTY_FIELD_LABELS: string[] = [];

export type AdminEditConfirmationDialogProps = {
	open: boolean;
	googleEventFieldLabels: string[];
	driveIdentityFieldLabels?: string[];
	isSaving: boolean;
	pricingFieldLabels: string[];
	nonPricingTitle?: string;
	pricingTitle?: string;
	description?: string;
	onCancel: () => void;
	onConfirm: () => void;
	onOpenChange: (open: boolean) => void;
};

function ChangedFieldList({ fields, title, description }: ChangedFieldListProps) {
	if (fields.length === 0) {
		return null;
	}

	return (
		<section className="grid gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
			<h3 className="font-bold text-sm">{title}</h3>
			<ul className="list-disc space-y-1 pl-5 text-sm">
				{fields.map((field) => (
					<li
						className="text-destructive"
						key={field}>
						{field}
					</li>
				))}
			</ul>
			{description ? <p className="text-foreground text-sm">{description}</p> : null}
		</section>
	);
}

export function AdminEditConfirmationDialog({
	open,
	googleEventFieldLabels,
	driveIdentityFieldLabels = EMPTY_FIELD_LABELS,
	isSaving,
	pricingFieldLabels,
	nonPricingTitle = "Calendar Event Changes",
	pricingTitle = "Pricing Changes",
	description = "Check what will change before saving.",
	onCancel,
	onConfirm,
	onOpenChange
}: AdminEditConfirmationDialogProps) {
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
					<DialogTitle>Confirm session changes</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<div className="grid gap-3">
					<ChangedFieldList
						title={nonPricingTitle}
						fields={googleEventFieldLabels}
					/>
					<ChangedFieldList
						title="Drive folder won't rename"
						fields={driveIdentityFieldLabels}
						description="Folder name and sharing stay as-is. Update in Google Drive if needed."
					/>
					<ChangedFieldList
						title={pricingTitle}
						fields={pricingFieldLabels}
						description={
							pricingFieldLabels.length > 0
								? "Send a custom Stripe invoice after saving."
								: undefined
						}
					/>
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
						variant="destructive"
						disabled={isSaving}
						onClick={onConfirm}>
						{isSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{isSaving ? "Saving" : "Make permanent changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
