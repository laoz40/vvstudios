import { create } from "zustand";

export type ModalState = { modal: "none" } | { modal: "feedback" } | { modal: "freeTour" };

const initialState: ModalState = { modal: "none" };

export const useModalStore = create<ModalState>(() => initialState);

// Zustand merges setState by default. Use replacement mode so modal transitions
// replace the full discriminated-union state instead of carrying stale fields forward.

export function openFeedbackModal() {
	useModalStore.setState({ modal: "feedback" }, true);
}

export function openFreeTourModal() {
	useModalStore.setState({ modal: "freeTour" }, true);
}

export function closeModal() {
	useModalStore.setState(initialState, true);
}
