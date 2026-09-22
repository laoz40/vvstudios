import { useEffect, type RefObject } from "react";
import { useSelector } from "@tanstack/react-store";
import { ChevronDown } from "lucide-react";
import { Button } from "#/components/ui/button";
import { useCompleteBookingShortcut } from "#studio/features/booking-form/hooks/useCompleteBookingShortcut";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";

type CompleteBookingScrollShortcutProps = {
	completeBookingTargetRef: RefObject<HTMLElement | null>;
	dateTimeSectionRef: RefObject<HTMLElement | null>;
	showScrollToCompleteBookingRef: RefObject<(() => void) | null>;
};

export function CompleteBookingScrollShortcut({
	completeBookingTargetRef,
	dateTimeSectionRef,
	showScrollToCompleteBookingRef
}: CompleteBookingScrollShortcutProps) {
	const formApi = useBookingFormContext();
	const bookingMode = useSelector(formApi.store, (state) => state.values.bookingMode);
	const date = useSelector(formApi.store, (state) => state.values.date);
	const time = useSelector(formApi.store, (state) => state.values.time);

	const isDateTimeIncomplete = bookingMode === "single" && (!date || !time);

	const completeBookingShortcut = useCompleteBookingShortcut({
		completeBookingTargetRef,
		dateTimeSectionRef,
		isDateTimeIncomplete
	});

	// Wire saved-booking reuse without rerendering the page shell.
	useEffect(() => {
		showScrollToCompleteBookingRef.current = () => {
			completeBookingShortcut.setShowScrollToCompleteBooking(true);
		};
	}, [completeBookingShortcut, showScrollToCompleteBookingRef]);

	if (bookingMode !== "single") {
		return null;
	}

	if (
		!completeBookingShortcut.showScrollToCompleteBooking ||
		completeBookingShortcut.hasReachedCompleteBooking
	) {
		return null;
	}

	return (
		<div className="fixed right-4 bottom-16 z-50 animate-in duration-200 fade-in zoom-in-150 motion-reduce:zoom-in-100 sm:right-6 sm:bottom-6">
			<Button
				type="button"
				size="icon-lg"
				aria-label={
					isDateTimeIncomplete ? "Scroll to date and time section" : "Scroll to complete booking"
				}
				className="rounded-full shadow-md active:scale-95 motion-reduce:transition-none"
				onClick={completeBookingShortcut.handleScrollToCompleteBooking}>
				<ChevronDown className="size-6" />
			</Button>
		</div>
	);
}
