import { create } from "zustand";

export type BookingModalState = { modal: "none" } | { modal: "addonCompatibility" };

const initialState: BookingModalState = { modal: "none" };

export const useBookingModalStore = create<BookingModalState>(() => initialState);

export function openAddonCompatibilityModal() {
	useBookingModalStore.setState({ modal: "addonCompatibility" });
}

export function closeBookingModal() {
	useBookingModalStore.setState(initialState);
}
