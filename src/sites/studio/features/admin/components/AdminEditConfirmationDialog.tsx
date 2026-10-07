import { LoaderCircle } from "lucide-react";

import { EditInvoicePreview } from "#studio/features/admin/components/EditInvoicePreview";
import type { useEditInvoice } from "#studio/features/admin/hooks/useEditInvoice";

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
	title?: string;
	invoice?: ReturnType<typeof useEditInvoice>;
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
			<h3 className="text-sm font-bold">{title}</h3>
			<ul className="list-disc space-y-1 pl-5 text-sm">
				{fields.map((field) => (
					<li
						className="text-destructive"
						key={field}>
						{field}
					</li>
				))}
			</ul>
			{description ? <p className="text-sm text-foreground">{description}</p> : null}
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
	title = "Confirm session changes",
	invoice,
	description = "Check what will change before saving.",
	onCancel,
	onConfirm,
	onOpenChange
}: AdminEditConfirmationDialogProps) {
	const activeInvoice = invoice?.open ? invoice : null;
	const isBusy = activeInvoice ? activeInvoice.isLoading || activeInvoice.isSending : isSaving;

	const close = () => {
		activeInvoice?.close();
		onCancel();
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (isBusy && !nextOpen) {
					return;
				}

				if (activeInvoice) {
					if (!nextOpen) {
						activeInvoice.close();
						onOpenChange(false);
					}
				} else {
					onOpenChange(nextOpen);
				}
			}}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<ConfirmationChanges
					googleEventFieldLabels={googleEventFieldLabels}
					driveIdentityFieldLabels={driveIdentityFieldLabels}
					nonPricingTitle={nonPricingTitle}
					pricingFieldLabels={pricingFieldLabels}
					activeInvoice={activeInvoice}
				/>
				<ConfirmationFooter
					activeInvoice={activeInvoice}
					isSaving={isSaving}
					onCancel={close}
					onConfirm={onConfirm}
				/>
			</DialogContent>
		</Dialog>
	);
}

type Invoice = ReturnType<typeof useEditInvoice>;

function ConfirmationChanges({
	googleEventFieldLabels,
	driveIdentityFieldLabels,
	nonPricingTitle,
	pricingFieldLabels,
	activeInvoice
}: Pick<AdminEditConfirmationDialogProps, "googleEventFieldLabels" | "pricingFieldLabels"> & {
	driveIdentityFieldLabels: string[];
	nonPricingTitle: string;
	activeInvoice: Invoice | null;
}) {
	return (
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
			{activeInvoice?.isLoading ? (
				<p
					role="status"
					className="flex items-center gap-2 text-sm">
					<LoaderCircle className="size-4 animate-spin" /> Generating invoice preview…
				</p>
			) : null}
			{activeInvoice?.quote ? (
				<>
					<EditInvoicePreview quote={activeInvoice.quote} />
					<p className="text-sm text-muted-foreground">
						{activeInvoice.invoiceSent ? (
							"The invoice has been sent. These changes are still unsaved."
						) : (
							<>
								Nothing has been saved. The invoice will be emailed to{" "}
								<span className="break-all">{activeInvoice.quote.customerEmail}</span> before these
								changes are saved.
							</>
						)}
					</p>
				</>
			) : null}
			{!activeInvoice && pricingFieldLabels.length > 0 ? (
				<p className="text-sm text-muted-foreground">
					No additional invoice is needed for these changes.
				</p>
			) : null}
			{activeInvoice?.error ? (
				<p
					role="alert"
					className="text-sm text-destructive">
					{activeInvoice.error}
				</p>
			) : null}
		</div>
	);
}

function ConfirmationFooter({
	activeInvoice,
	isSaving,
	onCancel,
	onConfirm
}: {
	activeInvoice: Invoice | null;
	isSaving: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	const isBusy = activeInvoice ? activeInvoice.isLoading || activeInvoice.isSending : isSaving;
	const close = onCancel;

	const confirmLabel = getConfirmationLabel(activeInvoice, isSaving);

	return (
		<DialogFooter>
			<Button
				type="button"
				variant="outline"
				disabled={isBusy}
				onClick={close}>
				{activeInvoice?.hasConfirmed ? "Back to edit" : "Cancel"}
			</Button>
			{activeInvoice?.error && !activeInvoice.hasConfirmed ? (
				<Button
					variant="outline"
					disabled={isBusy}
					onClick={() => void activeInvoice.reviewInvoice()}>
					Check invoice again
				</Button>
			) : null}
			{!activeInvoice || activeInvoice.quote ? (
				<Button
					type="button"
					variant={activeInvoice ? "default" : "destructive"}
					disabled={isBusy}
					onClick={activeInvoice ? () => void activeInvoice.confirmInvoice() : onConfirm}>
					{isBusy ? <LoaderCircle className="size-4 animate-spin" /> : null}
					{confirmLabel}
				</Button>
			) : null}
		</DialogFooter>
	);
}

function getConfirmationLabel(activeInvoice: Invoice | null, isSaving: boolean) {
	if (!activeInvoice) return isSaving ? "Saving" : "Save changes";

	if (activeInvoice.isSending) {
		if (activeInvoice.invoiceSent) return "Saving changes";

		return "Sending invoice and saving";
	}

	if (activeInvoice.invoiceSent) return "Retry saving changes";

	if (activeInvoice.hasConfirmed) return "Retry invoice and save";

	return "Send invoice and save changes";
}
