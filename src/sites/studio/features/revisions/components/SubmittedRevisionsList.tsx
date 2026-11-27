import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { withFeedbackRowKeys } from "#/domain/revisions/rules";
import {
	formatNotesCount,
	formatSubmittedRoundStatus,
	type RevisionEditCardItem
} from "#studio/features/revisions/lib/revision-errors";

export function SubmittedRevisionsList({
	rounds,
	requiresClipNumber
}: {
	rounds: RevisionEditCardItem["submittedRounds"];
	requiresClipNumber: boolean;
}) {
	const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

	if (rounds.length === 0) {
		return null;
	}

	function toggleRound(id: string) {
		setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
	}

	return (
		<div className="mt-4 space-y-2">
			{rounds.map((round) => {
				const isExpanded = expandedIds[round._id] === true;
				const statusCopy = formatSubmittedRoundStatus(round);

				return (
					<div
						key={round._id}
						className="rounded-lg border border-border bg-surface-subtle px-3.5 py-2.5">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
								<span className="font-medium text-foreground">Revision {round.roundNumber}</span>
								<span className="inline-flex items-center gap-1.5 text-primary">
									<span
										className="size-1.5 shrink-0 rounded-full bg-primary"
										aria-hidden="true"
									/>
									<span>{statusCopy}</span>
								</span>
							</div>
							<button
								type="button"
								onClick={() => toggleRound(round._id)}
								aria-expanded={isExpanded}
								className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
								<span>{formatNotesCount(round.feedbackRows.length)}</span>
								{isExpanded ? (
									<ChevronDown
										className="size-4"
										aria-hidden="true"
									/>
								) : (
									<ChevronRight
										className="size-4"
										aria-hidden="true"
									/>
								)}
							</button>
						</div>

						{isExpanded ? (
							<ul className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
								{withFeedbackRowKeys(round.feedbackRows, round._id).map(({ key, row }) => (
									<li
										key={key}
										className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
										<span className="shrink-0 font-mono text-xs text-primary sm:pt-0.5">
											{requiresClipNumber && row.clipNumber ? `Clip ${row.clipNumber} · ` : ""}
											{row.timestamp}
										</span>
										<span className="whitespace-pre-line text-foreground">{row.note}</span>
									</li>
								))}
							</ul>
						) : null}
					</div>
				);
			})}
		</div>
	);
}
