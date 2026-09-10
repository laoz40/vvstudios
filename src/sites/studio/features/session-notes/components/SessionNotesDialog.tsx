import { useEffect, useState, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { Field, FieldLabel } from "#/components/ui/field";
import { Textarea } from "#/components/ui/textarea";
import type { Id } from "#convex/_generated/dataModel";
import { tryCatch, type Result } from "#/lib/result";

type SessionNotesDialogProps = {
	bookingId: Id<"bookings">;
	description: ReactNode;
	fieldIdPrefix: string;
	fieldLabel: string;
	onOpenChange: (open: boolean) => void;
	onSave: (notes: string) => Promise<Result<null, { reason: string }>>;
	open: boolean;
	saveErrorMessage: string;
	saveSuccessMessage: string;
	savedNotes: string | undefined;
	title: string;
};

export function SessionNotesDialog({
	bookingId,
	description,
	fieldIdPrefix,
	fieldLabel,
	onOpenChange,
	onSave,
	open,
	saveErrorMessage,
	saveSuccessMessage,
	savedNotes,
	title
}: SessionNotesDialogProps) {
	const [notes, setNotes] = useState(savedNotes ?? "");
	const [isSaving, setIsSaving] = useState(false);
	const fieldId = `${fieldIdPrefix}-${bookingId}`;

	// Reset the unsaved notes to the latest stored value whenever this dialog opens.
	useEffect(() => {
		if (open) setNotes(savedNotes ?? "");
	}, [savedNotes, open]);

	async function handleSave() {
		setIsSaving(true);
		const [error] = await tryCatch(onSave(notes));
		setIsSaving(false);

		if (error !== null) {
			toast.error(saveErrorMessage);

			return;
		}

		toast.success(saveSuccessMessage);
		onOpenChange(false);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!isSaving) onOpenChange(nextOpen);
			}}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<Field>
					<FieldLabel htmlFor={fieldId}>{fieldLabel}</FieldLabel>
					<Textarea
						id={fieldId}
						value={notes}
						disabled={isSaving}
						placeholder="Write anything..."
						onChange={(event) => setNotes(event.target.value)}
					/>
				</Field>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled={isSaving}
						onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						type="button"
						disabled={isSaving}
						onClick={() => void handleSave()}>
						{isSaving ? (
							<LoaderCircle
								data-icon="inline-start"
								className="animate-spin"
							/>
						) : null}
						{isSaving ? "Saving" : "Save notes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
