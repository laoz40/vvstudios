import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { api } from "#convex/_generated/api";
import { studioSite } from "#/config/sites";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { BookingDateTimePicker } from "#studio/features/booking-form/components/BookingDateTimePicker";
import { BookingModalHost } from "#studio/features/booking-form/components/BookingModalHost";
import {
	buildDevRescheduleBooking,
	getDevRescheduleUpdateResult,
	parseRescheduleSearch,
	RescheduleDevScenarioPanel
} from "#studio/components/booking/RescheduleDevScenarioPanel";
import { RescheduleBookingSummary } from "#studio/components/booking/RescheduleBookingSummary";
import {
	closeBookingModal,
	openRescheduleConfirmationModal,
	useBookingModalStore
} from "#studio/features/booking-form/lib/booking-modal-store";
import {
	formatBookingDateSummary,
	formatBookingTimeRange,
	formatBookingTimestampDateLong,
	formatBookingTimestampTime
} from "#studio/lib/bookingdatetime";
import { useRescheduleAvailability } from "#studio/features/booking-form/hooks/useRescheduleAvailability";
import { tryCatch } from "#/lib/result";
import { buildNoIndexHead } from "#/lib/seo";
import { cn } from "#/lib/utils";
import { getRescheduleUpdateToastMessage } from "#studio/features/booking-form/lib/reschedule-errors";

export const Route = createFileRoute("/_public/reschedule/$token")({
	validateSearch: parseRescheduleSearch,
	head: () => buildNoIndexHead("Reschedule Booking | VV Studios"),
	component: ReschedulePage
});

function ReschedulePage() {
	// Route and navigation
	const { token } = Route.useParams();
	const { dev_scenario: devScenario } = Route.useSearch();
	const activeDevScenario = import.meta.env.DEV ? devScenario : undefined;
	const navigate = useNavigate();

	// Convex reads and actions
	const rescheduleSession = useAction(api.googleCalendar.rescheduleSession);
	const liveRescheduleBooking = useQuery(
		api.sessionReschedule.getRescheduleSessionByToken,
		activeDevScenario ? "skip" : { token }
	);

	// Active booking source
	const getRescheduleBooking = activeDevScenario
		? buildDevRescheduleBooking(activeDevScenario)
		: liveRescheduleBooking;
	const bookingDuration = getRescheduleBooking?.[1]?.session.duration ?? "";
	const {
		availability,
		hasCompleteSelection,
		invalidLinkMessage,
		selectedDateValue,
		selectedTime,
		setSelectedDateValue,
		setSelectedTime,
		timeSelectionMessage
	} = useRescheduleAvailability({ activeDevScenario, duration: bookingDuration, token });

	// Page status
	const [isUpdatingBooking, setIsUpdatingBooking] = useState(false);

	if (getRescheduleBooking === undefined) {
		return (
			<BookingStatusLayout
				showActions={false}
				devPanel={<RescheduleDevScenarioPanel token={token} />}>
				<StudioLoadingState label="Loading your session..." />
			</BookingStatusLayout>
		);
	}

	const [error, data] = getRescheduleBooking;

	if (isUpdatingBooking) {
		return (
			<BookingStatusLayout
				showActions={false}
				devPanel={<RescheduleDevScenarioPanel token={token} />}>
				<StudioLoadingState label="Updating your booking..." />
			</BookingStatusLayout>
		);
	}

	if (error !== null) {
		return (
			<BookingStatusLayout
				bookingStatus="failed"
				devPanel={<RescheduleDevScenarioPanel token={token} />}>
				<div>
					<h1 className="text-4xl font-semibold tracking-tight">
						This reschedule link is no longer valid.
					</h1>
					<p className="mt-4 text-muted-foreground">
						Please use the reschedule button in your latest invoice email.
					</p>
				</div>
			</BookingStatusLayout>
		);
	}

	const booking = data.session;
	async function navigateToRescheduleComplete(bookingId: string): Promise<void> {
		await navigate({
			to: studioSite.routes.rescheduleComplete,
			search: { booking_id: bookingId },
			replace: true
		});
	}

	function handleRequestUpdateBooking(): void {
		if (!selectedDateValue || !selectedTime) {
			toast.error("Please choose a new date and time first.");
			return;
		}

		openRescheduleConfirmationModal({
			date: selectedDateValue,
			dateSummary: formatBookingDateSummary(selectedDateValue),
			modal: "rescheduleConfirmation",
			time: selectedTime,
			timeSummary: formatBookingTimeRange(selectedTime, booking.duration)
		});
	}

	async function handleConfirmUpdateBooking(): Promise<void> {
		const confirmation = useBookingModalStore.getState();

		if (confirmation.modal !== "rescheduleConfirmation") {
			return;
		}

		setIsUpdatingBooking(true);

		try {
			if (activeDevScenario) {
				const [devUpdateError, devUpdate] = getDevRescheduleUpdateResult(activeDevScenario);

				if (devUpdateError !== null) {
					toast.error(getRescheduleUpdateToastMessage(devUpdateError));
					return;
				}

				closeBookingModal();
				await navigateToRescheduleComplete(devUpdate.bookingId);
				return;
			}

			const [rescheduleError, result] = await tryCatch(
				rescheduleSession({ date: confirmation.date, time: confirmation.time, token })
			);

			if (rescheduleError !== null) {
				toast.error(getRescheduleUpdateToastMessage(rescheduleError));
				return;
			}

			closeBookingModal();
			await navigateToRescheduleComplete(result.bookingId);
		} finally {
			setIsUpdatingBooking(false);
		}
	}

	if (invalidLinkMessage !== null) {
		return (
			<BookingStatusLayout
				bookingStatus="failed"
				devPanel={<RescheduleDevScenarioPanel token={token} />}>
				<div>
					<h1 className="text-4xl font-semibold tracking-tight">{invalidLinkMessage.title}</h1>
					<p className="mt-4 text-muted-foreground">{invalidLinkMessage.description}</p>
				</div>
			</BookingStatusLayout>
		);
	}
	return (
		<BookingStatusLayout
			showActions={false}
			className="max-w-4xl"
			devPanel={<RescheduleDevScenarioPanel token={token} />}>
			<div>
				<h1 className="text-left font-brand text-5xl leading-none uppercase md:text-center md:text-6xl">
					Reschedule your booking
				</h1>

				<RescheduleBookingSummary
					addons={booking.addons}
					date={booking.date}
					duration={booking.duration}
					service={booking.service}
					time={booking.time}
				/>

				<div className="mt-12">
					<BookingDateTimePicker
						availability={availability}
						onDateChange={(dateValue) => {
							setSelectedDateValue(dateValue);

							setSelectedTime("");
						}}
						onTimeChange={setSelectedTime}
						selectedTime={selectedTime}
						timeSelectionMessage={timeSelectionMessage}
					/>
				</div>

				<div className="mt-6">
					<Button
						type="button"
						className={cn(
							"h-12 w-full rounded-lg",
							"text-base font-bold! tracking-wider",
							"shadow-lg shadow-primary/45"
						)}
						disabled={!hasCompleteSelection || isUpdatingBooking}
						onClick={handleRequestUpdateBooking}>
						UPDATE BOOKING
					</Button>
				</div>
				<p className="mt-4 text-center text-xs text-muted-foreground">
					Reschedule link expires {formatBookingTimestampTime(data.expiresAt)},{" "}
					{formatBookingTimestampDateLong(data.expiresAt)}
				</p>
			</div>
			<BookingModalHost
				isSubmitting={isUpdatingBooking}
				onPaymentClose={() => {}}
				onRescheduleConfirm={() => {
					void handleConfirmUpdateBooking();
				}}
				onTermsConfirm={() => {}}
			/>
		</BookingStatusLayout>
	);
}
