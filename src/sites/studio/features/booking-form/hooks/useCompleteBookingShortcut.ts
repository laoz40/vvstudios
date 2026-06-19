import { useCallback, useEffect, useRef, useState } from "react";

export function useCompleteBookingShortcut(isDateTimeIncomplete: boolean) {
	const dateTimeSectionRef = useRef<HTMLDivElement>(null);
	const completeBookingButtonRef = useRef<HTMLDivElement>(null);
	const [showScrollToCompleteBooking, setShowScrollToCompleteBooking] = useState(false);
	const [hasReachedCompleteBooking, setHasReachedCompleteBooking] = useState(false);

	// Hide the complete booking shortcut once its target is visible.
	useEffect(() => {
		const updateHasReachedCompleteBooking = () => {
			const completeBookingButton = completeBookingButtonRef.current;

			if (!completeBookingButton) {
				setHasReachedCompleteBooking(false);
				return;
			}

			setHasReachedCompleteBooking(
				completeBookingButton.getBoundingClientRect().top <= window.innerHeight
			);
		};

		updateHasReachedCompleteBooking();
		window.addEventListener("scroll", updateHasReachedCompleteBooking, { passive: true });
		window.addEventListener("resize", updateHasReachedCompleteBooking);

		return () => {
			window.removeEventListener("scroll", updateHasReachedCompleteBooking);
			window.removeEventListener("resize", updateHasReachedCompleteBooking);
		};
	}, []);

	const handleScrollToCompleteBooking = useCallback(() => {
		const scrollTarget = isDateTimeIncomplete
			? dateTimeSectionRef.current
			: completeBookingButtonRef.current;

		scrollTarget?.scrollIntoView({
			behavior: "smooth",
			block: isDateTimeIncomplete ? "start" : "center"
		});
	}, [isDateTimeIncomplete]);

	return {
		completeBookingButtonRef,
		dateTimeSectionRef,
		handleScrollToCompleteBooking,
		hasReachedCompleteBooking,
		setShowScrollToCompleteBooking,
		showScrollToCompleteBooking
	};
}
