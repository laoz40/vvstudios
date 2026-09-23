import { useState, type ReactNode } from "react";
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
	fieldLabel?: string;
	onOpenChange: (open: boolean) => void;
	onSave: (notes: string) => Promise<Result<null, { reason: string }>>;
	open: boolean;
	saveErrorMessage: string;
	saveSuccessMessage: string;
	savedNotes: string | undefined;
	title: string;
};

type SessionNotesDialogFormProps = Omit<SessionNotesDialogProps, "open"> & {
	isSaving: boolean;
	setIsSaving: (isSaving: boolean) => void;
};

function SessionNotesDialogForm({
	bookingId,
	description,
	fieldIdPrefix,
	fieldLabel,
	isSaving,
	onOpenChange,
	onSave,
	setIsSaving,
	saveErrorMessage,
	saveSuccessMessage,
	savedNotes,
	title
}: SessionNotesDialogFormProps) {
	const [notes, setNotes] = useState(savedNotes ?? "");
	const fieldId = `${fieldIdPrefix}-${bookingId}`;

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
		<>
			<DialogHeader>
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>
			<Field>
				{fieldLabel ? <FieldLabel htmlFor={fieldId}>{fieldLabel}</FieldLabel> : null}
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
		</>
	);
}

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
	const [isSaving, setIsSaving] = useState(false);

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!isSaving) onOpenChange(nextOpen);
			}}>
			<DialogContent className="sm:max-w-lg">
				{open ? (
					<SessionNotesDialogForm
						key={bookingId}
						bookingId={bookingId}
						description={description}
						fieldIdPrefix={fieldIdPrefix}
						fieldLabel={fieldLabel}
						isSaving={isSaving}
						onOpenChange={onOpenChange}
						onSave={onSave}
						setIsSaving={setIsSaving}
						saveErrorMessage={saveErrorMessage}
						saveSuccessMessage={saveSuccessMessage}
						savedNotes={savedNotes}
						title={title}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
