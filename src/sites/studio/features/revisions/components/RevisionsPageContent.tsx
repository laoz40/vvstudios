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
		<section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
			<div className="space-y-1">
				<h2 className="text-base font-semibold text-foreground">
					Want to include logos, brand guidelines, or custom files?
				</h2>
				<p className="text-sm text-muted-foreground">
					You have a dedicated Google Drive folder where you can upload any custom files for our
					studio to use.
				</p>
			</div>
			<Button
				asChild
				variant="outline"
				size="sm"
				className="shrink-0 self-start sm:self-center">
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
			className="max-w-4xl justify-start pt-16 sm:pt-20">
			<header className="space-y-3">
				<h1 className="font-brand text-left text-5xl leading-none uppercase md:text-center md:text-6xl">
					Request revisions
				</h1>
				<p className="text-sm text-muted-foreground sm:text-base md:text-center">
					{data.session.name} · {sessionDateLabel} · {sessionTimeLabel}
				</p>
			</header>

			<RevisionOverviewCard pricing={data.pricing} />

			<section
				className="space-y-4"
				aria-label="Your edits">
				{edits.length === 0 ? (
					<div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
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
			</section>

			{data.session.assetsFolderUrl ? (
				<RevisionAssetsCard url={data.session.assetsFolderUrl} />
			) : null}
		</BookingStatusLayout>
	);
}
