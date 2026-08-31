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
		<section className="grid gap-2 rounded-lg border bg-muted/30 p-3">
			<h3 className="font-medium text-sm">{title}</h3>
			<ul className="list-disc space-y-1 pl-5 text-muted-foreground text-sm">
				{fields.map((field) => (
					<li key={field}>{field}</li>
				))}
			</ul>
			{description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
		</section>
	);
}

export function AdminEditConfirmationDialog({
	open,
	googleEventFieldLabels,
	driveIdentityFieldLabels = [],
	isSaving,
	pricingFieldLabels,
	nonPricingTitle = "Google Calendar event will update",
	pricingTitle = "Pricing or remaining balance may recalculate",
	description = "Review what this save will affect before making the session changes permanent.",
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
						title="Google Drive client folder will not be renamed"
						fields={driveIdentityFieldLabels}
						description="The client folder keeps its original name, and sharing stays on the original email. Update those in Google Drive yourself if needed."
					/>
					<ChangedFieldList
						title={pricingTitle}
						fields={pricingFieldLabels}
					/>
					<p className="text-muted-foreground text-sm">
						If an updated invoice is needed, send it manually after saving.
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
						{isSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{isSaving ? "Saving..." : "Save changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
