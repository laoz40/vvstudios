import { LoaderCircle } from "lucide-react";

import { exhaustiveCheck } from "#/lib/result";
import { EditInvoicePreview } from "#studio/features/admin/components/EditInvoicePreview";
import type { AdminEditConfirmationController } from "#studio/features/admin/hooks/useAdminEditConfirmation";
import {
	isAdminEditPhaseBusy,
	type AdminEditPhase
} from "#studio/features/admin/lib/admin-edit-machine";

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
	confirmation: AdminEditConfirmationController;
	nonPricingTitle?: string;
	title?: string;
	description?: string;
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
	confirmation,
	nonPricingTitle = "Calendar Event Changes",
	title = "Confirm session changes",
	description = "Check what will change before saving."
}: AdminEditConfirmationDialogProps) {
	const { phase, isOpen, dismiss } = confirmation;
	const isBusy = isAdminEditPhaseBusy(phase);

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(nextOpen) => {
				if (!nextOpen && !isBusy) {
					dismiss();
				}
			}}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<ConfirmationChanges
					phase={phase}
					nonPricingTitle={nonPricingTitle}
				/>
				<ConfirmationFooter confirmation={confirmation} />
			</DialogContent>
		</Dialog>
	);
}

function ConfirmationChanges({
	phase,
	nonPricingTitle
}: {
	phase: AdminEditPhase;
	nonPricingTitle: string;
}) {
	if (phase.kind === "idle" || phase.kind === "savingDirect") {
		return null;
	}

	const { warnings } = phase;

	return (
		<div className="grid gap-3">
			<ChangedFieldList
				title={nonPricingTitle}
				fields={warnings.primaryFieldLabels}
			/>
			<ChangedFieldList
				title="Drive folder won't rename"
				fields={warnings.driveIdentityFieldLabels}
				description="Folder name and sharing stay as-is. Update in Google Drive if needed."
			/>
			<ConfirmationPhaseDetails phase={phase} />
		</div>
	);
}

function ConfirmationPhaseDetails({
	phase
}: {
	phase: Exclude<AdminEditPhase, { kind: "idle" } | { kind: "savingDirect" }>;
}) {
	switch (phase.kind) {
		case "checkingInvoice":
			return (
				<p
					role="status"
					className="flex items-center gap-2 text-sm">
					<LoaderCircle className="size-4 animate-spin" /> Generating invoice preview…
				</p>
			);
		case "invoiceCheckFailed":
			return (
				<p
					role="alert"
					className="text-sm text-destructive">
					{phase.error}
				</p>
			);
		case "readyToConfirm":
		case "savingConfirmed":
			return phase.warnings.pricingFieldLabels.length > 0 ? (
				<p className="text-sm text-muted-foreground">
					No additional invoice is needed for these changes.
				</p>
			) : null;
		case "invoiceConfirm":
			return (
				<>
					<EditInvoicePreview quote={phase.quote} />
					<p className="text-sm text-muted-foreground">
						{phase.invoiceSent ? (
							"The invoice has been sent. These changes are still unsaved."
						) : (
							<>
								Nothing has been saved. The invoice will be emailed to{" "}
								<span className="break-all">{phase.quote.customerEmail}</span> before these changes
								are saved.
							</>
						)}
					</p>
					{phase.error ? (
						<p
							role="alert"
							className="text-sm text-destructive">
							{phase.error}
						</p>
					) : null}
				</>
			);
		case "sendingInvoice":
			return (
				<>
					<EditInvoicePreview quote={phase.quote} />
					<p className="text-sm text-muted-foreground">
						{phase.invoiceSent ? (
							"The invoice has been sent. These changes are still unsaved."
						) : (
							<>
								Nothing has been saved. The invoice will be emailed to{" "}
								<span className="break-all">{phase.quote.customerEmail}</span> before these changes
								are saved.
							</>
						)}
					</p>
				</>
			);
		default:
			return exhaustiveCheck(phase);
	}
}

function getInvoiceConfirmLabel(
	phase: Extract<AdminEditPhase, { kind: "invoiceConfirm" }>
): string {
	if (phase.invoiceSent) {
		return "Retry saving changes";
	}

	if (phase.hasConfirmed) {
		return "Retry invoice and save";
	}

	return "Send invoice and save changes";
}

function ConfirmationFooter({ confirmation }: { confirmation: AdminEditConfirmationController }) {
	const { phase, confirm, dismiss, retryInvoiceCheck } = confirmation;

	switch (phase.kind) {
		case "idle":
		case "savingDirect":
			return null;
		case "checkingInvoice":
			return (
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled>
						Cancel
					</Button>
				</DialogFooter>
			);
		case "invoiceCheckFailed":
			return (
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={dismiss}>
						Cancel
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={retryInvoiceCheck}>
						Check invoice again
					</Button>
				</DialogFooter>
			);
		case "readyToConfirm":
			return (
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={dismiss}>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={confirm}>
						Save changes
					</Button>
				</DialogFooter>
			);
		case "savingConfirmed":
			return (
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						disabled>
						<LoaderCircle className="size-4 animate-spin" />
						Saving
					</Button>
				</DialogFooter>
			);
		case "invoiceConfirm":
			return (
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={dismiss}>
						{phase.hasConfirmed ? "Back to edit" : "Cancel"}
					</Button>
					{phase.error && !phase.hasConfirmed ? (
						<Button
							type="button"
							variant="outline"
							onClick={retryInvoiceCheck}>
							Check invoice again
						</Button>
					) : null}
					<Button
						type="button"
						variant="default"
						onClick={confirm}>
						{getInvoiceConfirmLabel(phase)}
					</Button>
				</DialogFooter>
			);
		case "sendingInvoice":
			return (
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled>
						Back to edit
					</Button>
					<Button
						type="button"
						variant="default"
						disabled>
						<LoaderCircle className="size-4 animate-spin" />
						{phase.invoiceSent ? "Saving changes" : "Sending invoice and saving"}
					</Button>
				</DialogFooter>
			);
		default:
			return exhaustiveCheck(phase);
	}
}
