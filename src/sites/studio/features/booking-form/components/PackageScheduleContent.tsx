import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { tryCatch } from "#/lib/result";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { BookingModalHost } from "#studio/features/booking-form/components/BookingModalHost";
import { PackageSessionDetailsModal } from "#studio/features/booking-form/components/PackageSessionDetailsModal";
import { PackageSessionsAccordion } from "#studio/features/booking-form/components/PackageSessionsAccordion";
import { usePackageSchedule } from "#studio/features/booking-form/hooks/usePackageSchedule";
import { sectionHeadingClassName } from "#studio/features/booking-form/lib/booking-form-styles";
import {
	closeBookingModal,
	openPackageUnscheduleConfirmationModal,
	useBookingModalStore
} from "#studio/features/booking-form/lib/booking-modal-store";
import { recordingSpaceSchema } from "#studio/features/booking-form/lib/booking-form-model";
import {
	getSaveDefaultSpaceToastMessage,
	getSavePackageBookingToastMessage,
	getUnschedulePackageBookingToastMessage
} from "#studio/features/booking-form/lib/package-scheduling-errors";
import { getPackageSchedulingProgressMessage } from "#studio/features/booking-form/lib/package-scheduling-rules";
import {
	performPackageSessionSave,
	performPackageSessionUnschedule
} from "#studio/features/booking-form/lib/package-scheduling-session";
import {
	formatBookingDateSummary,
	formatBookingTimestampDateLong,
	formatBookingTimestampTime
} from "#studio/lib/bookingdatetime";

type PackageData = NonNullable<
	FunctionReturnType<typeof api.packageScheduling.getPackageByToken>[1]
>;

export function handlePackageUnscheduleRequest(bookingId: Id<"bookings">, date: string) {
	openPackageUnscheduleConfirmationModal({
		bookingId,
		dateSummary: formatBookingDateSummary(date),
		modal: "packageUnscheduleConfirmation",
		type: "unschedule"
	});
}

export function PackageScheduleContent({
	packageData,
	token
}: {
	packageData: PackageData;
	token: string;
}) {
	const createPackageSession = useAction(api.packageScheduling.createPackageSession);
	const setDefaultSpace = useMutation(api.packageScheduling.setDefaultSpace);
	const reschedulePackageSession = useAction(api.packageScheduling.reschedulePackageSession);
	const unschedulePackageSession = useAction(api.packageScheduling.unschedulePackageSession);
	const scheduling = usePackageSchedule({ packageData, token });
	const [savingSessionKey, setSavingSessionKey] = useState<string | null>(null);
	const [isSavingDefaultSpace, setIsSavingDefaultSpace] = useState(false);
	const [unschedulingBookingId, setUnschedulingBookingId] = useState<Id<"bookings"> | null>(null);

	const schedulingProgressMessage = getPackageSchedulingProgressMessage(
		packageData.packageSize,
		packageData.sessions.length
	);

	async function handleMakeDefaultSpace() {
		const service = recordingSpaceSchema.safeParse(scheduling.selectedService).data;
		if (!service) {
			return;
		}

		setIsSavingDefaultSpace(true);
		const [saveError] = await tryCatch(setDefaultSpace({ service, token }));
		setIsSavingDefaultSpace(false);

		if (saveError !== null) {
			toast.error(getSaveDefaultSpaceToastMessage(saveError));
			return;
		}

		toast.success("Default recording space saved.");
	}

	function handleRequestSaveSession() {
		if (scheduling.activeSessionKey === null) {
			toast.error("Choose a session first.");
			return;
		}

		if (!scheduling.selectedDateValue || !scheduling.selectedTime || !scheduling.selectedService) {
			toast.error("Please choose a date, time, and recording space first.");
			return;
		}

		void handleSaveSession();
	}

	async function handleConfirmUnschedule() {
		const confirmation = useBookingModalStore.getState();

		if (confirmation.modal !== "packageUnscheduleConfirmation") {
			return;
		}

		await handleUnschedule(confirmation.bookingId);
	}

	async function handleSaveSession() {
		if (scheduling.activeSessionKey === null) {
			return;
		}

		const service = recordingSpaceSchema.safeParse(scheduling.selectedService).data;
		if (!service) {
			return;
		}

		setSavingSessionKey(scheduling.activeSessionKey);

		const sessionInput = {
			date: scheduling.selectedDateValue,
			time: scheduling.selectedTime,
			service,
			notes: scheduling.selectedNotes,
			remotePodcast: scheduling.selectedRemotePodcast,
			token
		};
		const saveOutcome = await performPackageSessionSave(
			scheduling.activeBooking,
			sessionInput,
			createPackageSession,
			reschedulePackageSession
		);

		setSavingSessionKey(null);

		if (saveOutcome.status === "error") {
			toast.error(
				getSavePackageBookingToastMessage(saveOutcome.error, scheduling.noticeWindowLabel)
			);
			return;
		}

		closeBookingModal();
		scheduling.handleCloseSession();
		scheduling.setHighlightedBookingId(saveOutcome.bookingId);
		toast.success(
			saveOutcome.wasReschedule
				? "Session rescheduled. Check your email for the updated invitation."
				: "Calendar event created. Check your email for the invitation."
		);
		scheduling.invalidateCalendarCache();
	}

	async function handleUnschedule(bookingId: Id<"bookings">) {
		setUnschedulingBookingId(bookingId);
		const unscheduleOutcome = await performPackageSessionUnschedule(
			bookingId,
			token,
			unschedulePackageSession
		);
		setUnschedulingBookingId(null);

		if (unscheduleOutcome.status === "error") {
			toast.error(
				getUnschedulePackageBookingToastMessage(
					unscheduleOutcome.error,
					scheduling.noticeWindowLabel
				)
			);
			return;
		}

		closeBookingModal();
		const wasEditingBooking = scheduling.activeSessionKey === bookingId;
		scheduling.handleCloseSession();
		scheduling.setHighlightedBookingId(null);
		scheduling.invalidateCalendarCache();

		if (wasEditingBooking) {
			scheduling.clearSessionSelection();
		}

		toast.success("Session unscheduled.");
	}

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
					savingSessionKey={savingSessionKey}
					isSavingDefaultSpace={isSavingDefaultSpace}
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
						void handleMakeDefaultSpace();
					}}
					onNotesChange={scheduling.setSelectedNotes}
					onRemotePodcastChange={scheduling.handleRemotePodcastChange}
					onServiceChange={scheduling.setSelectedService}
					onRequestUnschedule={handlePackageUnscheduleRequest}
					onRequestSaveSession={handleRequestSaveSession}
					onSessionClose={scheduling.handleCloseSession}
					onSessionSelect={scheduling.handleChooseSession}
					onTimeChange={scheduling.setSelectedTime}
				/>

				<p className="mt-6 text-center text-xs text-muted-foreground">
					Sessions can be changed until {scheduling.noticeWindowLabel} before they start.
				</p>
			</div>
			<BookingModalHost
				isSubmitting={savingSessionKey !== null || unschedulingBookingId !== null}
				onPackageUnscheduleConfirm={() => {
					void handleConfirmUnschedule();
				}}
				onPaymentClose={() => {}}
				onTermsConfirm={() => {}}
			/>
		</BookingStatusLayout>
	);
}
