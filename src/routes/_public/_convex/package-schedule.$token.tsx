import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "#convex/_generated/api";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { PackageScheduleContent } from "#studio/features/booking-form/components/PackageScheduleContent";
import { getPackageLinkInvalidMessage } from "#studio/features/booking-form/lib/package-scheduling-errors";
import { buildNoIndexHead } from "#/lib/seo";

export const Route = createFileRoute("/_public/_convex/package-schedule/$token")({
	head: () => buildNoIndexHead("Schedule Package Sessions | VV Studios"),
	component: MultiBookingSchedulePage
});

function MultiBookingSchedulePage() {
	const { token } = Route.useParams();
	const packageResult = useQuery(api.packageScheduling.getPackageByToken, { token });

	if (packageResult === undefined) {
		return (
			<BookingStatusLayout showActions={false}>
				<StudioLoadingState label="Getting your package..." />
			</BookingStatusLayout>
		);
	}

	const [packageError, packageData] = packageResult;

	if (packageError !== null) {
		const invalidMessage = getPackageLinkInvalidMessage(packageError);
		return (
			<BookingStatusLayout bookingStatus="failed">
				<div>
					<h1 className="text-4xl font-semibold tracking-tight">{invalidMessage.title}</h1>
					<p className="mt-4 text-muted-foreground">{invalidMessage.description}</p>
				</div>
			</BookingStatusLayout>
		);
	}

	return (
		<PackageScheduleContent
			packageData={packageData}
			token={token}
		/>
	);
}
