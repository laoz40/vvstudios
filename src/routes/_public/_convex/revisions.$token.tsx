import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { buildNoIndexHead } from "#/lib/seo";
import { api } from "#convex/_generated/api";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { RevisionsPageContent } from "#studio/features/revisions/components/RevisionsPageContent";
import { getFeedbackLinkInvalidMessage } from "#studio/features/revisions/lib/revision-errors";

export const Route = createFileRoute("/_public/_convex/revisions/$token")({
	head: () => {
		const noIndex = buildNoIndexHead("Request Revisions | VV Studios");

		return { ...noIndex, meta: [...noIndex.meta, { name: "referrer", content: "no-referrer" }] };
	},
	component: RevisionsPage
});

function RevisionsPage() {
	const { token } = Route.useParams();
	const sessionResult = useQuery(api.revisions.public.getFeedbackSessionByToken, { token });

	if (sessionResult === undefined) {
		return (
			<BookingStatusLayout
				showActions={false}
				devPanel={null}>
				<StudioLoadingState label="Loading your edits" />
			</BookingStatusLayout>
		);
	}

	const [sessionError, sessionData] = sessionResult;

	if (sessionError !== null) {
		const invalidMessage = getFeedbackLinkInvalidMessage(sessionError);

		return (
			<BookingStatusLayout
				showActions={false}
				devPanel={null}>
				<div>
					<h1 className="text-4xl font-semibold tracking-tight">{invalidMessage.title}</h1>
					<p className="mt-4 text-muted-foreground">{invalidMessage.description}</p>
				</div>
			</BookingStatusLayout>
		);
	}

	return (
		<RevisionsPageContent
			token={token}
			data={sessionData}
		/>
	);
}
