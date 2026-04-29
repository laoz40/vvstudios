import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";

export const Route = createFileRoute("/booking-expired")({
	component: BookingExpiredPage,
});

function BookingExpiredPage() {
	return (
		<main className="mx-auto flex max-w-3xl flex-col gap-8 py-10">
			<section className="flex flex-col gap-8">
				<div className="space-y-4">
					<h1 className="text-3xl font-semibold leading-tight md:text-6xl">
						Your payment session expired
					</h1>
					<p className="max-w-2xl text-base text-muted-foreground">
						The booking deposit wasn&apos;t completed in time, so this checkout session is no longer
						available.
					</p>
				</div>

				<div className="flex flex-wrap gap-3">
					<Button asChild>
						<Link to="/book">Try again</Link>
					</Button>
					<Button
						asChild
						variant="outline">
						<Link to="/">Return home</Link>
					</Button>
				</div>
			</section>
		</main>
	);
}
