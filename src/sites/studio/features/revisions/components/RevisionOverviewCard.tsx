import type { FeedbackSessionData } from "#studio/features/revisions/lib/revision-errors";

export function RevisionOverviewCard({ pricing }: { pricing: FeedbackSessionData["pricing"] }) {
	const items = [
		{
			title: "Free revisions",
			description:
				"1 free for Rough Cut & Clip Volume Pack · 2 free for Complete Edit & Handcrafted Clips"
		},
		{
			title: "Revision window",
			description: "2 business days after each delivery (closes 11:59 pm Sydney time)"
		},
		{
			title: "Extra revisions",
			description: `$${pricing.paidRoundPriceAud} AUD (incl. GST) each, up to ${pricing.maxPaidRounds} extra revisions per edit`
		},
		{
			title: "Editing time",
			description: "Initial edits usually take around 6 days from your session"
		}
	];

	return (
		<section className="grid grid-cols-1 gap-5 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 sm:gap-6">
			{items.map((item) => (
				<div
					key={item.title}
					className="space-y-1">
					<h2 className="text-sm font-medium text-foreground">{item.title}</h2>
					<p className="text-sm text-muted-foreground">{item.description}</p>
				</div>
			))}
		</section>
	);
}
