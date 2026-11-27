import type { Dispatch } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { formatNotesCount } from "#studio/features/revisions/lib/revision-errors";
import type {
	RevisionFormAction,
	RevisionFormState
} from "#studio/features/revisions/lib/revision-form";

export function RevisionConfirmDialog({
	title,
	remainingAfterSubmit,
	submission,
	dispatch,
	onConfirm
}: {
	title: string;
	remainingAfterSubmit: number;
	submission: RevisionFormState["submission"];
	dispatch: Dispatch<RevisionFormAction>;
	onConfirm: () => void;
}) {
	const confirmationRows =
		submission.kind === "confirming" || submission.kind === "submitting"
			? submission.validatedRows
			: null;

	const isSubmitting = submission.kind === "submitting";

	return (
		<Dialog
			open={confirmationRows !== null}
			onOpenChange={(open) => {
				if (!open && submission.kind === "confirming") {
					dispatch({ type: "close_confirm" });
				}
			}}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Submit revision request?</DialogTitle>
					<DialogDescription>
						This submits your changes and uses 1 free revision for{" "}
						<span className="font-medium text-foreground">{title}</span>.
					</DialogDescription>
				</DialogHeader>
				{confirmationRows !== null ? (
					<div className="space-y-2 rounded-lg border border-border bg-surface-subtle p-3.5 text-sm">
						<div className="flex items-center justify-between gap-2">
							<span className="text-muted-foreground">Edit</span>
							<span className="font-medium text-foreground">{title}</span>
						</div>
						<div className="flex items-center justify-between gap-2">
							<span className="text-muted-foreground">Changes included</span>
							<span className="font-medium text-foreground">
								{formatNotesCount(confirmationRows.length)}
							</span>
						</div>
						<div className="flex items-center justify-between gap-2">
							<span className="text-muted-foreground">Free revisions left after submit</span>
							<span className="font-medium text-green">{remainingAfterSubmit}</span>
						</div>
					</div>
				) : null}
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled={isSubmitting}
						onClick={() => dispatch({ type: "close_confirm" })}>
						Cancel
					</Button>
					<Button
						type="button"
						disabled={isSubmitting}
						onClick={onConfirm}>
						{isSubmitting ? (
							<>
								<Loader2
									className="size-4 animate-spin"
									aria-hidden="true"
								/>
								Submitting
							</>
						) : (
							"Confirm & send"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
