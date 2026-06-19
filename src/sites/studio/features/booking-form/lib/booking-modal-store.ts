import { create } from "zustand";

export type BookingModalState =
	| { modal: "none" }
	| { modal: "addonCompatibility" }
	| { modal: "sessionSummary"; dateSummary: string; timeSummary: string };

const initialState: BookingModalState = { modal: "none" };

export const useBookingModalStore = create<BookingModalState>(() => initialState);

export function openAddonCompatibilityModal() {
	useBookingModalStore.setState({ modal: "addonCompatibility" });
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

export function closeBookingModal() {
	useBookingModalStore.setState(initialState);
}
