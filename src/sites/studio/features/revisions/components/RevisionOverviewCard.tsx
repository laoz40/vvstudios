import type { FeedbackSessionData } from "#studio/features/revisions/lib/revision-errors";

export function RevisionOverviewCard({ pricing }: { pricing: FeedbackSessionData["pricing"] }) {
	const items = [
		{
			title: "Free revisions",
			lines: [
				"1 free for Rough Cut & Clip Volume Pack",
				"2 free for Complete Edit & Handcrafted Clips"
			]
		},
		{
			title: "Extra revisions",
			lines: [
				`$${pricing.paidRoundPriceAud} AUD (incl. GST) each, up to ${pricing.maxPaidRounds} extra revisions per edit`
			]
		}
	];

	return (
		<section
			aria-labelledby="revision-rules-heading"
			className="space-y-2.5 sm:space-y-3">
			<h2
				id="revision-rules-heading"
				className="text-sm font-semibold text-primary">
				Rules
			</h2>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
				{items.map((item) => (
					<div
						key={item.title}
						className="space-y-1.5 rounded-xl border border-border p-4 sm:p-5">
						<h3 className="text-sm font-medium text-foreground">{item.title}</h3>
						<div className="space-y-1 text-sm leading-relaxed text-muted-foreground">
							{item.lines.map((line) => (
								<p key={line}>{line}</p>
							))}
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
