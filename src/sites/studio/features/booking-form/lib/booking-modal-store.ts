import { create } from "zustand";

import type { EmbeddedCheckoutSession } from "#studio/features/booking-form/lib/checkout-session";

export type BookingModalState =
	| { modal: "none" }
	| { modal: "addonCompatibility" }
	| { modal: "payment"; checkoutSession: EmbeddedCheckoutSession }
	| { modal: "requestCall" }
	| { modal: "sessionSummary"; dateSummary: string; timeSummary: string }
	| { modal: "terms" };

const initialState: BookingModalState = { modal: "none" };

export const useBookingModalStore = create<BookingModalState>(() => initialState);

export function openAddonCompatibilityModal() {
	useBookingModalStore.setState({ modal: "addonCompatibility" });
}

export function openPaymentModal(checkoutSession: EmbeddedCheckoutSession) {
	useBookingModalStore.setState({ modal: "payment", checkoutSession });
}

export function openRequestCallModal() {
	useBookingModalStore.setState({ modal: "requestCall" });
}

export function openSessionSummaryModal({
	dateSummary,
	timeSummary
}: {
	dateSummary: string;
	timeSummary: string;
}) {
	useBookingModalStore.setState({ modal: "sessionSummary", dateSummary, timeSummary });
}

export function openTermsModal() {
	useBookingModalStore.setState({ modal: "terms" });
}

export function closeBookingModal() {
	useBookingModalStore.setState(initialState);
}
