import { useReducer, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { formatRevisionDeadline, validateRevisionFeedbackRows } from "#/domain/revisions/rules";
import { exhaustiveCheck, tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import { RevisionRequestDialog } from "#studio/features/revisions/components/RevisionRequestDialog";
import { SubmittedRevisionsDialog } from "#studio/features/revisions/components/SubmittedRevisionsDialog";
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
	onOpenRequestDialog: () => void,
	onOpenHistoryDialog: () => void
) {
	const historyButton =
		edit.submittedRounds.length > 0 ? (
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="flex-1 sm:flex-initial"
				onClick={onOpenHistoryDialog}>
				View revisions ({edit.submittedRounds.length})
			</Button>
		) : null;

	switch (edit.state.kind) {
		case "not_delivered":
			return {
				subtitle: "Usually ready in around 6 days from your session",
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

			const statusLabel = hasActiveRevision ? (
				<span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary">
					<span
						className="size-2 shrink-0 rounded-full bg-primary"
						aria-hidden="true"
					/>
					<span>Revision in progress</span>
				</span>
			) : (
				<span className="shrink-0 text-sm text-muted-foreground">Closed</span>
			);

			return {
				subtitle: formatClosedEditSummary(edit.state),
				trailing: historyButton ? (
					<div className="flex items-center justify-between gap-3 sm:shrink-0 sm:justify-end">
						{statusLabel}
						{historyButton}
					</div>
				) : (
					statusLabel
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
				trailing: (
					<div className="flex items-center gap-2 sm:shrink-0">
						{historyButton}
						<Button
							type="button"
							size="sm"
							className="flex-1 sm:flex-initial"
							onClick={onOpenRequestDialog}>
							Request revisions
						</Button>
					</div>
				)
			};

		default:
			return exhaustiveCheck(edit.state);
	}
}

export function RevisionEditCard({ token, edit }: { token: string; edit: RevisionEditCardItem }) {
	const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
	const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

	const [formState, dispatch] = useReducer(
		revisionFormReducer,
		undefined,
		createInitialRevisionFormState
	);

	const submitFreeRevision = useMutation(api.revisions.public.submitFreeRevisionRound);
	const title = formatEditCardTitle(edit);

	async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (formState.submissionStatus === "submitting") return;

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

		dispatch({ type: "start_submit" });

		const [error, result] = await tryCatch(
			submitFreeRevision({ token, editId: edit._id, feedbackRows: validation.rows })
		);

		if (error !== null) {
			dispatch({ type: "submit_failed" });
			toast.error(getSubmitRevisionErrorMessage(error));

			return;
		}

		dispatch({ type: "reset" });
		setIsRequestDialogOpen(false);
		toast.success(`Revision ${result.roundNumber} requested for ${title}.`);
	}

	const header = renderEditCardHeaderContent(
		edit,
		() => setIsRequestDialogOpen(true),
		() => setIsHistoryDialogOpen(true)
	);

	return (
		<div className="rounded-xl border border-border bg-card p-4 sm:p-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
				<div className="space-y-1">
					<h3 className="text-sm font-semibold text-foreground sm:text-base">{title}</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">{header.subtitle}</p>
				</div>
				{header.trailing}
			</div>

			{edit.submittedRounds.length > 0 ? (
				<SubmittedRevisionsDialog
					open={isHistoryDialogOpen}
					title={title}
					rounds={edit.submittedRounds}
					requiresClipNumber={edit.requiresClipNumber}
					onOpenChange={setIsHistoryDialogOpen}
				/>
			) : null}

			{edit.state.kind === "open_free" || edit.state.kind === "open_paid" ? (
				<RevisionRequestDialog
					open={isRequestDialogOpen}
					title={title}
					edit={edit}
					formState={formState}
					dispatch={dispatch}
					onOpenChange={setIsRequestDialogOpen}
					onSubmit={(event) => void handleRequestSubmit(event)}
				/>
			) : null}
		</div>
	);
}
