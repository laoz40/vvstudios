import { terms } from "#studio/features/booking-form/components/TermsDialog";

const lastUpdated = "11 May 2026";

export function TermsAndConditionsPage() {
	return (
		<main className="px-4 py-12 md:px-10 md:py-16">
			<div className="mx-auto max-w-4xl space-y-10">
				<h1 className="text-center text-4xl font-brand font-black tracking-tight md:text-6xl uppercase">
					Terms & Conditions
				</h1>

				<div className="space-y-8">
					{terms.map((section) => (
						<section
							key={section.title}
							className="space-y-2">
							<h2 className="text-xl font-bold tracking-tight">{section.title}</h2>
							<p className="text-muted-foreground leading-relaxed">{section.body}</p>
						</section>
					))}
				</div>

				<p className="text-muted-foreground text-sm">Last updated: {lastUpdated}</p>
			</div>
		</main>
	);
}
