import type { Dispatch, FormEvent, ReactNode } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { PAID_REVISION_PRICE_AUD } from "#/domain/revisions/rules";
import type { RevisionEditCardItem } from "#studio/features/revisions/lib/revision-errors";
import type {
	RevisionFormAction,
	RevisionFormState
} from "#studio/features/revisions/lib/revision-form";

function FeedbackField({
	id,
	label,
	error,
	className,
	children
}: {
	id: string;
	label: string;
	error?: string;
	className?: string;
	children: ReactNode;
}) {
	return (
		<div className={className ? `space-y-1 ${className}` : "space-y-1"}>
			<label
				htmlFor={id}
				className="block text-xs font-medium text-muted-foreground">
				{label}
			</label>
			{children}
			{error ? <p className="text-xs text-destructive">{error}</p> : null}
		</div>
	);
}

export function RevisionRequestDialog({
	open,
	title,
	edit,
	formState,
	dispatch,
	onOpenChange,
	onSubmit
}: {
	open: boolean;
	title: string;
	edit: RevisionEditCardItem;
	formState: RevisionFormState;
	dispatch: Dispatch<RevisionFormAction>;
	onOpenChange: (open: boolean) => void;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
	const isSubmitting = formState.submissionStatus === "submitting";

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!isSubmitting) {
					onOpenChange(nextOpen);
				}
			}}>
			<DialogContent className="flex flex-col sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Request revisions for {title}</DialogTitle>
					<DialogDescription>
						{edit.scope === "corrections_only"
							? "Limited to corrections to cuts, timing, and text errors."
							: "List each timestamp and the change you need."}
					</DialogDescription>
				</DialogHeader>

				<form
					onSubmit={onSubmit}
					className="flex min-h-0 flex-1 flex-col gap-4"
					noValidate>
					<div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-0.5">
						{formState.rows.map((row, index) => {
							const errors = formState.rowErrors[index] ?? {};
							const clipId = `clip-${edit._id}-${row.id}`;
							const timestampId = `timestamp-${edit._id}-${row.id}`;
							const noteId = `note-${edit._id}-${row.id}`;

							return (
								<div
									key={row.id}
									className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-start">
									{edit.requiresClipNumber ? (
										<FeedbackField
											id={clipId}
											label="Clip #"
											error={errors.clipNumber}
											className="sm:col-span-2">
											<Input
												id={clipId}
												disabled={isSubmitting}
												value={row.clipNumber}
												onChange={(event) =>
													dispatch({
														type: "update_field",
														id: row.id,
														field: "clipNumber",
														value: event.target.value
													})
												}
												onBlur={() =>
													dispatch({
														type: "blur_field",
														id: row.id,
														field: "clipNumber",
														requiresClipNumber: edit.requiresClipNumber
													})
												}
												placeholder="1"
												aria-invalid={errors.clipNumber !== undefined}
											/>
										</FeedbackField>
									) : null}

									<FeedbackField
										id={timestampId}
										label="Timestamp"
										error={errors.timestamp}
										className={edit.requiresClipNumber ? "sm:col-span-3" : "sm:col-span-4"}>
										<Input
											id={timestampId}
											disabled={isSubmitting}
											value={row.timestamp}
											onChange={(event) =>
												dispatch({
													type: "update_field",
													id: row.id,
													field: "timestamp",
													value: event.target.value
												})
											}
											onBlur={() =>
												dispatch({
													type: "blur_field",
													id: row.id,
													field: "timestamp",
													requiresClipNumber: edit.requiresClipNumber
												})
											}
											placeholder="01:23 or 01:23-01:45"
											aria-invalid={errors.timestamp !== undefined}
										/>
									</FeedbackField>

									<div
										className={
											edit.requiresClipNumber
												? "flex items-start gap-2 sm:col-span-7"
												: "flex items-start gap-2 sm:col-span-8"
										}>
										<FeedbackField
											id={noteId}
											label="Change needed"
											error={errors.note}
											className="flex-1">
											<Textarea
												id={noteId}
												rows={1}
												disabled={isSubmitting}
												className="min-h-9 resize-none py-1.5"
												value={row.note}
												onChange={(event) =>
													dispatch({
														type: "update_field",
														id: row.id,
														field: "note",
														value: event.target.value
													})
												}
												onBlur={() =>
													dispatch({
														type: "blur_field",
														id: row.id,
														field: "note",
														requiresClipNumber: edit.requiresClipNumber
													})
												}
												placeholder="Describe the change at this timestamp"
												aria-invalid={errors.note !== undefined}
											/>
										</FeedbackField>
										{formState.rows.length > 1 ? (
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												disabled={isSubmitting}
												className="mt-5 shrink-0 text-muted-foreground hover:text-destructive"
												aria-label={`Remove change row ${index + 1}`}
												onClick={() => dispatch({ type: "remove_row", id: row.id })}>
												<Trash2
													className="size-4"
													aria-hidden="true"
												/>
											</Button>
										) : null}
									</div>
								</div>
							);
						})}

						{formState.formError ? (
							<p className="text-sm text-destructive">{formState.formError}</p>
						) : null}

						<div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={isSubmitting}
								className="px-2 text-muted-foreground hover:text-foreground"
								onClick={() => dispatch({ type: "add_row" })}>
								<Plus
									className="size-4"
									aria-hidden="true"
								/>
								Add another
							</Button>
						</div>
					</div>

					<DialogFooter className="border-t border-border pt-4 sm:items-center sm:justify-between">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={isSubmitting}
							onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<div className="flex flex-wrap items-center justify-end gap-3">
							{edit.state.kind === "open_free" ? (
								<span className="text-sm font-medium text-green">
									Free · {edit.freeRoundsRemaining} of {edit.freeRoundsAllowed} left
								</span>
							) : (
								<span className="text-sm font-medium text-foreground">
									${PAID_REVISION_PRICE_AUD} AUD (incl. GST)
								</span>
							)}
							<Button
								type="submit"
								size="sm"
								disabled={isSubmitting}>
								{isSubmitting ? (
									<>
										<Loader2
											className="size-4 animate-spin"
											aria-hidden="true"
										/>
										Submitting
									</>
								) : (
									"Submit revision request"
								)}
							</Button>
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
