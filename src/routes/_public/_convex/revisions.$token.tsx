import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { buildNoIndexHead } from "#/lib/seo";
import { api } from "#convex/_generated/api";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
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
			<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
				<StudioLoadingState label="Loading your edits" />
			</main>
		);
	}

	const [sessionError, sessionData] = sessionResult;

	if (sessionError !== null) {
		const invalidMessage = getFeedbackLinkInvalidMessage(sessionError);

		return (
			<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10 sm:px-6">
				<div className="space-y-3 rounded-xl border border-border bg-card p-6">
					<h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
						{invalidMessage.title}
					</h1>
					<p className="text-sm text-muted-foreground sm:text-base">{invalidMessage.description}</p>
				</div>
			</main>
		);
	}

	return (
		<RevisionsPageContent
			token={token}
			data={sessionData}
		/>
	);
}
