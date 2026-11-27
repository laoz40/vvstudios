import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from "#/components/ui/accordion";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { withFeedbackRowKeys } from "#/domain/revisions/rules";
import {
	formatNotesCount,
	formatSubmittedRoundStatus,
	type RevisionEditCardItem
} from "#studio/features/revisions/lib/revision-errors";

export function SubmittedRevisionsDialog({
	open,
	title,
	rounds,
	requiresClipNumber,
	onOpenChange
}: {
	open: boolean;
	title: string;
	rounds: RevisionEditCardItem["submittedRounds"];
	requiresClipNumber: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const roundsLabel =
		rounds.length === 1 ? "1 revision requested" : `${rounds.length} revisions requested`;

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className="flex flex-col sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Revisions for {title}</DialogTitle>
					<DialogDescription>{roundsLabel}</DialogDescription>
				</DialogHeader>

				<Accordion
					type="multiple"
					className="min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-0.5">
					{rounds.map((round) => {
						const statusCopy = formatSubmittedRoundStatus(round);

						return (
							<AccordionItem
								key={round._id}
								value={round._id}
								className="rounded-lg border border-border bg-surface-subtle px-4 last:border-b">
								<AccordionTrigger className="items-center py-3 text-sm font-normal hover:text-foreground md:py-3">
									<div className="flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
										<span className="font-medium text-foreground">
											Revision {round.roundNumber}{" "}
											<span className="font-normal text-muted-foreground">
												· {formatNotesCount(round.feedbackRows.length)}
											</span>
										</span>
										<span className="inline-flex items-center gap-1.5 text-primary">
											<span
												className="size-1.5 shrink-0 rounded-full bg-primary"
												aria-hidden="true"
											/>
											<span>{statusCopy}</span>
										</span>
									</div>
								</AccordionTrigger>

								<AccordionContent
									layout={false}
									className="max-w-none pb-3 text-sm leading-normal md:pb-3 md:text-sm">
									<ul className="space-y-2 border-t border-border pt-3 text-sm">
										{withFeedbackRowKeys(round.feedbackRows, round._id).map(({ key, row }) => (
											<li
												key={key}
												className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
												<span className="shrink-0 font-mono text-xs text-primary">
													{requiresClipNumber && row.clipNumber ? `Clip ${row.clipNumber} · ` : ""}
													{row.timestamp}
												</span>
												<span className="whitespace-pre-line text-foreground">{row.note}</span>
											</li>
										))}
									</ul>
								</AccordionContent>
							</AccordionItem>
						);
					})}
				</Accordion>

				<DialogFooter className="border-t border-border pt-4">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
