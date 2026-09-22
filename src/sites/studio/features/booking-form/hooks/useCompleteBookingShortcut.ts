import { useEffect, useRef, useState, type RefObject } from "react";

export function useCompleteBookingShortcut(
	isDateTimeIncomplete: boolean,
	completeBookingTargetRef: RefObject<HTMLElement | null>
) {
	const dateTimeSectionRef = useRef<HTMLDivElement>(null);
	const [showScrollToCompleteBooking, setShowScrollToCompleteBooking] = useState(false);
	const [hasReachedCompleteBooking, setHasReachedCompleteBooking] = useState(false);

	// Track whether the submit section is visible only while the scroll cue is shown.
	useEffect(() => {
		if (!showScrollToCompleteBooking) {
			setHasReachedCompleteBooking(false);

			return undefined;
		}

		const updateHasReachedCompleteBooking = () => {
			const completeBookingTarget = completeBookingTargetRef.current;

			if (!completeBookingTarget) {
				setHasReachedCompleteBooking(false);

				return;
			}

			const hasReached = completeBookingTarget.getBoundingClientRect().top <= window.innerHeight;

			setHasReachedCompleteBooking((current) => (current === hasReached ? current : hasReached));
		};

		updateHasReachedCompleteBooking();
		window.addEventListener("scroll", updateHasReachedCompleteBooking, { passive: true });
		window.addEventListener("resize", updateHasReachedCompleteBooking);

		return () => {
			window.removeEventListener("scroll", updateHasReachedCompleteBooking);
			window.removeEventListener("resize", updateHasReachedCompleteBooking);
		};
	}, [completeBookingTargetRef, showScrollToCompleteBooking]);

	function handleScrollToCompleteBooking() {
		const scrollTarget = isDateTimeIncomplete
			? dateTimeSectionRef.current
			: completeBookingTargetRef.current;

		scrollTarget?.scrollIntoView({
			behavior: "smooth",
			block: isDateTimeIncomplete ? "start" : "center"
		});
	}

	return {
		dateTimeSectionRef,
		handleScrollToCompleteBooking,
		hasReachedCompleteBooking,
		setShowScrollToCompleteBooking,
		showScrollToCompleteBooking
	};
}
