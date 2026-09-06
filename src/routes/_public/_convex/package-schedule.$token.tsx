import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { BookingModalHost } from "#studio/features/booking-form/components/BookingModalHost";
import { PackageSessionDetailsModal } from "#studio/features/booking-form/components/PackageSessionDetailsModal";
import { PackageSessionsAccordion } from "#studio/features/booking-form/components/PackageSessionsAccordion";
import { usePackageSchedule } from "#studio/features/booking-form/hooks/usePackageSchedule";
import { sectionHeadingClassName } from "#studio/features/booking-form/lib/booking-form-styles";
import { openPackageUnscheduleConfirmationModal } from "#studio/features/booking-form/lib/booking-modal-store";
import { getPackageLinkInvalidMessage } from "#studio/features/booking-form/lib/package-scheduling-errors";
import { getPackageSchedulingProgressMessage } from "#studio/features/booking-form/lib/package-scheduling-rules";
import {
	formatBookingDateSummary,
	formatBookingTimestampDateLong,
	formatBookingTimestampTime
} from "#studio/lib/bookingdatetime";
import { buildNoIndexHead } from "#/lib/seo";

export const Route = createFileRoute("/_public/_convex/package-schedule/$token")({
	head: () => buildNoIndexHead("Schedule Package Sessions | VV Studios"),
	component: MultiBookingSchedulePage
});

type GetPackageByTokenResult = FunctionReturnType<typeof api.packageScheduling.getPackageByToken>;

function handleRequestUnschedule(bookingId: Id<"bookings">, date: string) {
	openPackageUnscheduleConfirmationModal({
		bookingId,
		dateSummary: formatBookingDateSummary(date),
		modal: "packageUnscheduleConfirmation",
		type: "unschedule"
	});
}

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

function PackageScheduleContent({
	packageData,
	token
}: {
	packageData: NonNullable<GetPackageByTokenResult[1]>;
	token: string;
}) {
	const scheduling = usePackageSchedule({ packageData, token });
	const schedulingProgressMessage = getPackageSchedulingProgressMessage(
		packageData.packageSize,
		packageData.sessions.length
	);

	return (
		<BookingStatusLayout
			showActions={false}
			className="max-w-4xl justify-start pt-16 sm:pt-20">
			<div>
				<h1 className="text-left font-brand text-5xl leading-none uppercase md:text-center md:text-6xl">
					Schedule your package sessions
				</h1>

				<div className="mt-8 text-left sm:text-center">
					<p className="text-xl font-semibold">{schedulingProgressMessage}</p>
					<p className="mt-2 text-muted-foreground">
						Scheduling expires {formatBookingTimestampTime(packageData.expiresAt)},{" "}
						{formatBookingTimestampDateLong(packageData.expiresAt)}.
					</p>
				</div>

				<div className="mt-8 flex items-center justify-start gap-4">
					<h2 className={sectionHeadingClassName}>Your Sessions</h2>
					<PackageSessionDetailsModal packageData={packageData} />
				</div>

				<PackageSessionsAccordion
					activeSessionKey={scheduling.activeSessionKey}
					availability={scheduling.availability}
					highlightedBookingId={scheduling.highlightedBookingId}
					isDefaultSpace={scheduling.selectedService === packageData.defaultSpace}
					packageData={packageData}
					savingSessionKey={scheduling.savingSessionKey}
					isSavingDefaultSpace={scheduling.isSavingDefaultSpace}
					selectedDateValue={scheduling.selectedDateValue}
					selectedNotes={scheduling.selectedNotes}
					selectedRemotePodcast={scheduling.selectedRemotePodcast}
					selectedService={scheduling.selectedService}
					selectedTime={scheduling.selectedTime}
					timeSelectionMessage={scheduling.timeSelectionMessage}
					currentTimestamp={scheduling.currentTimestamp}
					leadTimeMinutes={scheduling.availabilitySettings.leadTimeMinutes}
					onDateChange={scheduling.handleDateChange}
					onMakeDefaultSpace={() => {
						void scheduling.handleMakeDefaultSpace();
					}}
					onNotesChange={scheduling.setSelectedNotes}
					onRemotePodcastChange={scheduling.handleRemotePodcastChange}
					onServiceChange={scheduling.setSelectedService}
					onRequestUnschedule={handleRequestUnschedule}
					onRequestSaveSession={scheduling.handleRequestSaveSession}
					onSessionClose={scheduling.handleCloseSession}
					onSessionSelect={scheduling.handleChooseSession}
					onTimeChange={scheduling.setSelectedTime}
				/>

				<p className="mt-6 text-center text-xs text-muted-foreground">
					Sessions can be changed until {scheduling.noticeWindowLabel} before they start.
				</p>
			</div>
			<BookingModalHost
				isSubmitting={
					scheduling.savingSessionKey !== null || scheduling.unschedulingBookingId !== null
				}
				onPackageUnscheduleConfirm={() => {
					void scheduling.handleConfirmUnschedule();
				}}
				onPaymentClose={() => {}}
				onTermsConfirm={() => {}}
			/>
		</BookingStatusLayout>
	);
}
