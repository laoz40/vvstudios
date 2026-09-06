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
import { usePackageSessionDatePicker } from "#studio/features/booking-form/hooks/usePackageSessionDatePicker";
import { usePackageSessionDraft } from "#studio/features/booking-form/hooks/usePackageSessionDraft";
import { usePackageSessionMutations } from "#studio/features/booking-form/hooks/usePackageSessionMutations";
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
	const draft = usePackageSessionDraft({ packageData });
	const datePicker = usePackageSessionDatePicker({
		excludeGoogleEventId: draft.activeBooking?.googleEventId,
		packageData,
		selectedDateValue: draft.selectedDateValue,
		token
	});
	const mutations = usePackageSessionMutations({
		activeBooking: draft.activeBooking,
		activeSessionKey: draft.activeSessionKey,
		clearSessionDraft: draft.clearSessionDraft,
		invalidateCalendarCache: datePicker.invalidateCalendarCache,
		noticeWindowLabel: datePicker.noticeWindowLabel,
		selectedDateValue: draft.selectedDateValue,
		selectedNotes: draft.selectedNotes,
		selectedRemotePodcast: draft.selectedRemotePodcast,
		selectedService: draft.selectedService,
		selectedTime: draft.selectedTime,
		setActiveSessionKey: draft.setActiveSessionKey,
		setHighlightedBookingId: draft.setHighlightedBookingId,
		token
	});
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
					activeSessionKey={draft.activeSessionKey}
					availability={datePicker.availability}
					highlightedBookingId={draft.highlightedBookingId}
					isDefaultSpace={draft.selectedService === packageData.defaultSpace}
					packageData={packageData}
					savingSessionKey={mutations.savingSessionKey}
					isSavingDefaultSpace={mutations.isSavingDefaultSpace}
					selectedDateValue={draft.selectedDateValue}
					selectedNotes={draft.selectedNotes}
					selectedRemotePodcast={draft.selectedRemotePodcast}
					selectedService={draft.selectedService}
					selectedTime={draft.selectedTime}
					timeSelectionMessage={datePicker.timeSelectionMessage}
					currentTimestamp={datePicker.currentTimestamp}
					leadTimeMinutes={datePicker.availabilitySettings.leadTimeMinutes}
					onDateChange={draft.handleDateChange}
					onMakeDefaultSpace={() => {
						void mutations.handleMakeDefaultSpace();
					}}
					onNotesChange={draft.setSelectedNotes}
					onRemotePodcastChange={draft.handleRemotePodcastChange}
					onServiceChange={draft.setSelectedService}
					onRequestUnschedule={handleRequestUnschedule}
					onRequestSaveSession={mutations.handleRequestSaveSession}
					onSessionClose={draft.handleCloseSession}
					onSessionSelect={draft.handleChooseSession}
					onTimeChange={draft.setSelectedTime}
				/>

				<p className="mt-6 text-center text-xs text-muted-foreground">
					Sessions can be changed until {datePicker.noticeWindowLabel} before they start.
				</p>
			</div>
			<BookingModalHost
				isSubmitting={
					mutations.savingSessionKey !== null || mutations.unschedulingBookingId !== null
				}
				onPackageUnscheduleConfirm={() => {
					void mutations.handleConfirmUnschedule();
				}}
				onPaymentClose={() => {}}
				onTermsConfirm={() => {}}
			/>
		</BookingStatusLayout>
	);
}
