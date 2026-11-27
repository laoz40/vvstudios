import { useReducer, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { formatRevisionDeadline, validateRevisionFeedbackRows } from "#/domain/revisions/rules";
import { exhaustiveCheck, tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import { RevisionConfirmDialog } from "#studio/features/revisions/components/RevisionConfirmDialog";
import { RevisionRequestForm } from "#studio/features/revisions/components/RevisionRequestForm";
import { SubmittedRevisionsList } from "#studio/features/revisions/components/SubmittedRevisionsList";
import {
	formatClosedEditSummary,
	formatEditCardTitle,
	getSubmitRevisionErrorMessage,
	type RevisionEditCardItem
} from "#studio/features/revisions/lib/revision-errors";
import {
	createInitialRevisionFormState,
	revisionFormReducer
} from "#studio/features/revisions/lib/revision-form";

function renderEditCardHeaderContent(
	edit: RevisionEditCardItem,
	isFormOpen: boolean,
	onToggleForm: () => void
) {
	switch (edit.state.kind) {
		case "not_delivered":
			return {
				subtitle: "Usually ready in around 6 days from your session",
				alignClass: "sm:items-start",
				trailing: (
					<span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary">
						<span
							className="size-2 shrink-0 rounded-full bg-primary"
							aria-hidden="true"
						/>
						<span>Editing in progress</span>
					</span>
				)
			};

		case "closed": {
			const hasActiveRevision = edit.submittedRounds.some((round) => round.status === "requested");

			return {
				subtitle: formatClosedEditSummary(edit.state),
				alignClass: "sm:items-start",
				trailing: hasActiveRevision ? (
					<span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary">
						<span
							className="size-2 shrink-0 rounded-full bg-primary"
							aria-hidden="true"
						/>
						<span>Revision in progress</span>
					</span>
				) : (
					<span className="shrink-0 text-sm text-muted-foreground">Closed</span>
				)
			};
		}

		case "open_free":
		case "open_paid":
			return {
				subtitle: (
					<>
						Request changes by{" "}
						<span className="font-medium text-foreground">
							{formatRevisionDeadline(edit.state.windowEndsAt)}
						</span>
					</>
				),
				alignClass: "sm:items-center",
				trailing: (
					<Button
						type="button"
						variant={isFormOpen ? "outline" : "default"}
						size="sm"
						className="self-start sm:self-center"
						onClick={onToggleForm}>
						{isFormOpen ? "Close" : "Request revisions"}
					</Button>
				)
			};

		default:
			return exhaustiveCheck(edit.state);
	}
}

export function RevisionEditCard({ token, edit }: { token: string; edit: RevisionEditCardItem }) {
	const [isFormOpen, setIsFormOpen] = useState(false);

	const [formState, dispatch] = useReducer(
		revisionFormReducer,
		undefined,
		createInitialRevisionFormState
	);

	const submitFreeRevision = useMutation(api.revisions.public.submitFreeRevisionRound);
	const title = formatEditCardTitle(edit);

	function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const validation = validateRevisionFeedbackRows(
			formState.rows.map((row) => ({
				timestamp: row.timestamp,
				note: row.note,
				clipNumber: edit.requiresClipNumber ? row.clipNumber : undefined
			})),
			edit.requiresClipNumber
		);

		if (!validation.ok) {
			dispatch({
				type: "validation_failed",
				formError: validation.formError ?? null,
				rowErrors: validation.rowErrors
			});

			return;
		}

		if (edit.state.kind === "open_paid") {
			toast.info("Paid revision checkout is not connected yet.");

			return;
		}

		dispatch({ type: "open_confirm", validatedRows: validation.rows });
	}

	async function handleConfirmSubmit() {
		if (formState.submission.kind !== "confirming") return;
		const { validatedRows } = formState.submission;

		dispatch({ type: "start_submit" });

		const [error, result] = await tryCatch(
			submitFreeRevision({ token, editId: edit._id, feedbackRows: validatedRows })
		);

		if (error !== null) {
			dispatch({ type: "submit_failed" });
			toast.error(getSubmitRevisionErrorMessage(error));

			return;
		}

		dispatch({ type: "reset" });
		setIsFormOpen(false);
		toast.success(`Revision ${result.roundNumber} requested for ${title}.`);
	}

	const header = renderEditCardHeaderContent(edit, isFormOpen, () =>
		setIsFormOpen((open) => !open)
	);

	return (
		<section className="rounded-xl border border-border bg-card p-5">
			<div className={`flex flex-col gap-3 sm:flex-row sm:justify-between ${header.alignClass}`}>
				<div className="space-y-1">
					<h2 className="text-base font-semibold text-foreground">{title}</h2>
					<p className="text-sm text-muted-foreground">{header.subtitle}</p>
				</div>
				{header.trailing}
			</div>

			{edit.state.kind !== "not_delivered" ? (
				<SubmittedRevisionsList
					rounds={edit.submittedRounds}
					requiresClipNumber={edit.requiresClipNumber}
				/>
			) : null}

			{(edit.state.kind === "open_free" || edit.state.kind === "open_paid") && isFormOpen ? (
				<RevisionRequestForm
					edit={edit}
					formState={formState}
					dispatch={dispatch}
					onSubmit={handleRequestSubmit}
				/>
			) : null}

			{edit.state.kind === "open_free" ? (
				<RevisionConfirmDialog
					title={title}
					remainingAfterSubmit={Math.max(0, edit.freeRoundsRemaining - 1)}
					submission={formState.submission}
					dispatch={dispatch}
					onConfirm={() => void handleConfirmSubmit()}
				/>
			) : null}
		</section>
	);
}
