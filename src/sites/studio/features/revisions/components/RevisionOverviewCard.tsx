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
			aria-label="Revision policy"
			className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5">
			{items.map((item) => (
				<div
					key={item.title}
					className="space-y-1.5 rounded-xl border border-border bg-card p-4 sm:p-5">
					<h2 className="text-sm font-medium text-foreground">{item.title}</h2>
					<div className="space-y-1 text-sm text-muted-foreground">
						{item.lines.map((line) => (
							<p key={line}>{line}</p>
						))}
					</div>
				</div>
			))}
		</section>
	);
}
