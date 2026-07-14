import { create } from "zustand";

import type { Id } from "#convex/_generated/dataModel";
import type { EmbeddedCheckoutSession } from "#studio/features/booking-form/lib/checkout-session";

export type BookingModalState =
	| { modal: "none" }
	| { modal: "payment"; checkoutSession: EmbeddedCheckoutSession }
	| {
			bookingId: Id<"bookings">;
			dateSummary: string;
			modal: "packageUnscheduleConfirmation";
			type: "unschedule";
	  }
	| {
			modal: "rescheduleConfirmation";
			date: string;
			dateSummary: string;
			time: string;
			timeSummary: string;
	  }
	| { modal: "terms" };

const initialState: BookingModalState = { modal: "none" };

export const useBookingModalStore = create<BookingModalState>(() => initialState);

// Zustand merges setState by default. Use replacement mode to discard stale fields
// from previous modal variants and keep BookingModalState's union invariant valid.

export function openPaymentModal(checkoutSession: EmbeddedCheckoutSession) {
	useBookingModalStore.setState({ modal: "payment", checkoutSession }, true);
}

export function openPackageUnscheduleConfirmationModal(
	confirmation: Extract<BookingModalState, { modal: "packageUnscheduleConfirmation" }>
) {
	useBookingModalStore.setState(confirmation, true);
}

export function openRescheduleConfirmationModal(
	confirmation: Extract<BookingModalState, { modal: "rescheduleConfirmation" }>
) {
	useBookingModalStore.setState(confirmation, true);
}

export function openTermsModal() {
	useBookingModalStore.setState({ modal: "terms" }, true);
}

export function closeBookingModal() {
	useBookingModalStore.setState(initialState, true);
}
