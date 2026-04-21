import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";

export const Route = createFileRoute("/booking-complete")({
	component: BookingCompletePage,
});

function BookingCompletePage() {
	return (
		<main className="mx-auto flex max-w-3xl flex-col gap-8 py-8">
			<div className="flex flex-col gap-2">
				<h1 className="text-3xl font-semibold">Booking status</h1>
				<p className="text-muted-foreground">
					Payment status and booking details will be shown here once the return page is wired to
					Convex.
				</p>
			</div>

			<div className="flex flex-wrap gap-3">
				<Button
					asChild
					variant="outline">
					<Link to="/">Return home</Link>
				</Button>
				<Button asChild>
					<Link to="/book">Make a new booking</Link>
				</Button>
			</div>
		</main>
	);
}
