import { ExternalLink } from "lucide-react";
import { Button } from "#/components/ui/button";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { RevisionEditCard } from "#studio/features/revisions/components/RevisionEditCard";
import { RevisionOverviewCard } from "#studio/features/revisions/components/RevisionOverviewCard";
import {
	flattenSessionEdits,
	type FeedbackSessionData
} from "#studio/features/revisions/lib/revision-errors";
import { formatBookingDateSummary, formatBookingTimeRange } from "#studio/lib/bookingdatetime";

function RevisionAssetsCard({ url }: { url: string }) {
	return (
		<section
			aria-labelledby="revision-assets-heading"
			className="space-y-2.5 sm:space-y-3">
			<h2
				id="revision-assets-heading"
				className="text-sm font-semibold text-primary">
				Your assets
			</h2>
			<div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-5">
				<div className="space-y-1.5">
					<h3 className="text-sm leading-snug font-semibold text-foreground sm:text-base">
						Want to include logos, brand guidelines, or custom files?
					</h3>
					<p className="text-sm leading-relaxed text-muted-foreground">
						You have a dedicated Google Drive folder where you can upload any custom files for our
						studio to use.
					</p>
				</div>
				<Button
					asChild
					variant="outline"
					size="sm"
					className="w-full sm:w-auto sm:shrink-0">
					<a
						href={url}
						target="_blank"
						rel="noopener noreferrer">
						Upload to Google Drive
						<ExternalLink
							className="size-4"
							aria-hidden="true"
						/>
					</a>
				</Button>
			</div>
		</section>
	);
}

export function RevisionsPageContent({
	token,
	data
}: {
	token: string;
	data: FeedbackSessionData;
}) {
	const edits = flattenSessionEdits(data.groups);
	const sessionDateLabel = formatBookingDateSummary(data.session.date);
	const sessionTimeLabel = formatBookingTimeRange(data.session.time, data.session.duration);

	return (
		<BookingStatusLayout
			showActions={false}
			devPanel={null}
			className="max-w-4xl justify-start gap-8 pt-8 pb-12 sm:gap-10 sm:pt-16">
			<header className="space-y-2 sm:space-y-3">
				<h1 className="font-brand text-left text-4xl leading-none uppercase sm:text-5xl md:text-center md:text-6xl">
					Request revisions
				</h1>
				<p className="text-sm text-muted-foreground sm:text-base md:text-center">
					{data.session.name} · {sessionDateLabel} · {sessionTimeLabel}
				</p>
			</header>

			<RevisionOverviewCard pricing={data.pricing} />

			<section
				aria-labelledby="revision-edits-heading"
				className="space-y-2.5 sm:space-y-3">
				<h2
					id="revision-edits-heading"
					className="text-sm font-semibold text-primary">
					Edit jobs
				</h2>
				<div className="space-y-3">
					{edits.length === 0 ? (
						<div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
							No editing add-ons were found for this session.
						</div>
					) : (
						edits.map((edit) => (
							<RevisionEditCard
								key={edit._id}
								token={token}
								edit={edit}
							/>
						))
					)}
				</div>
			</section>

			{data.session.assetsFolderUrl ? (
				<RevisionAssetsCard url={data.session.assetsFolderUrl} />
			) : null}
		</BookingStatusLayout>
	);
}
