import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";

export const Route = createFileRoute("/booking-expired")({
	component: BookingExpiredPage,
});

function BookingExpiredPage() {
	return (
		<main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
			<section className="flex flex-col gap-8">
				<div className="space-y-4">
					<h1 className="text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl">
						Your payment session expired
					</h1>
					<p className="max-w-2xl text-base text-muted-foreground">
						The booking deposit wasn&apos;t completed in time, so this checkout session is no longer
						available.
					</p>
				</div>

				<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
					<Button
						asChild
						className="w-full sm:w-auto">
						<Link to="/book">Try again</Link>
					</Button>
					<Button
						asChild
						className="w-full sm:w-auto"
						variant="outline">
						<Link to="/">Return home</Link>
					</Button>
				</div>
			</section>
		</main>
	);
}
