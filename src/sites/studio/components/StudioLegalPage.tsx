export type StudioLegalPageSection = { body: string; title: string };

export type StudioLegalPageProps = {
	lastUpdated: string;
	sections: readonly StudioLegalPageSection[];
	title: string;
};

export function StudioLegalPage({ lastUpdated, sections, title }: StudioLegalPageProps) {
	return (
		<main className="px-4 py-12 md:px-10 md:py-16">
			<div className="mx-auto max-w-4xl space-y-10">
				<h1 className="font-brand text-center text-4xl font-black tracking-tight uppercase md:text-6xl">
					{title}
				</h1>

				<div className="space-y-8">
					{sections.map((section) => (
						<section
							key={section.title}
							className="space-y-2">
							<h2 className="text-xl font-bold tracking-tight">{section.title}</h2>
							<p className="leading-relaxed text-muted-foreground">{section.body}</p>
						</section>
					))}
				</div>

				<p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
			</div>
		</main>
	);
}
