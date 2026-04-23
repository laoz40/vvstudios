import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";

export interface PlaceholderPageProps {
	body: string;
	title: string;
}

export function PlaceholderPage({ body, title }: PlaceholderPageProps) {
	return (
		<main className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-5xl items-center">
			<section className="w-full rounded-2xl border bg-card/70 p-8 shadow-lg backdrop-blur-xs md:p-12">
				<p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
					VV Podcast Studio
				</p>
				<h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
				<p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">{body}</p>
				<div className="mt-8 flex flex-wrap gap-3">
					<Button asChild>
						<Link to="/book">Book session</Link>
					</Button>
					<Button
						asChild
						variant="outline">
						<Link to="/contact">Contact</Link>
					</Button>
				</div>
			</section>
		</main>
	);
}
