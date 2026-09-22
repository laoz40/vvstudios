import { useEffect, type RefObject } from "react";
import { useSelector } from "@tanstack/react-store";
import { ChevronDown } from "lucide-react";
import { Button } from "#/components/ui/button";
import { BookingDateTimeSection } from "#studio/features/booking-form/components/BookingDateTimeSection";
import { useBookingAvailability } from "#studio/features/booking-form/hooks/useBookingAvailability";
import { useCompleteBookingShortcut } from "#studio/features/booking-form/hooks/useCompleteBookingShortcut";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";

type BookingSingleSessionSchedulingProps = {
	completeBookingTargetRef: RefObject<HTMLElement | null>;
	setAvailabilityErrorRef?: RefObject<((message: string) => void) | null>;
	showScrollToCompleteBookingRef: RefObject<(() => void) | null>;
};

export function BookingSingleSessionScheduling({
	completeBookingTargetRef,
	setAvailabilityErrorRef,
	showScrollToCompleteBookingRef
}: BookingSingleSessionSchedulingProps) {
	const formApi = useBookingFormContext();
	const bookingMode = useSelector(formApi.store, (state) => state.values.bookingMode);
	const date = useSelector(formApi.store, (state) => state.values.date);
	const time = useSelector(formApi.store, (state) => state.values.time);
	const duration = useSelector(formApi.store, (state) => state.values.duration);

	const isDateTimeIncomplete = bookingMode === "single" && (!date || !time);

	function handleSelectedTimeInvalidated() {
		formApi.setFieldValue("time", "");
	}

	const availability = useBookingAvailability({
		date,
		duration,
		onSelectedTimeInvalidated: handleSelectedTimeInvalidated,
		selectedTime: time
	});

	const completeBookingShortcut = useCompleteBookingShortcut(
		isDateTimeIncomplete,
		completeBookingTargetRef
	);

	// Wire saved-booking reuse and dev tooling without rerendering the page shell.
	useEffect(() => {
		showScrollToCompleteBookingRef.current = () => {
			completeBookingShortcut.setShowScrollToCompleteBooking(true);
		};

		if (setAvailabilityErrorRef) {
			setAvailabilityErrorRef.current = availability.setAvailabilityError;
		}
	}, [
		availability,
		completeBookingShortcut,
		setAvailabilityErrorRef,
		showScrollToCompleteBookingRef
	]);

	if (bookingMode !== "single") {
		return null;
	}

	return (
		<>
			<div
				ref={completeBookingShortcut.dateTimeSectionRef}
				className="scroll-mt-32 sm:scroll-mt-40">
				<BookingDateTimeSection availability={availability} />
			</div>

			{completeBookingShortcut.showScrollToCompleteBooking &&
			!completeBookingShortcut.hasReachedCompleteBooking ? (
				<div className="fixed right-4 bottom-16 z-50 animate-in duration-200 fade-in zoom-in-150 motion-reduce:zoom-in-100 sm:right-6 sm:bottom-6">
					<Button
						type="button"
						size="icon-lg"
						aria-label={
							isDateTimeIncomplete
								? "Scroll to date and time section"
								: "Scroll to complete booking"
						}
						className="rounded-full shadow-md active:scale-95 motion-reduce:transition-none"
						onClick={completeBookingShortcut.handleScrollToCompleteBooking}>
						<ChevronDown className="size-6" />
					</Button>
				</div>
			) : null}
		</>
	);
}
