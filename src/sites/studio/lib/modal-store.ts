import { create } from "zustand";

export type ModalState = { modal: "none" } | { modal: "feedback" } | { modal: "freeTour" };

const initialState: ModalState = { modal: "none" };

export const useModalStore = create<ModalState>(() => initialState);

export function openFeedbackModal() {
	useModalStore.setState({ modal: "feedback" });
}

export function openFreeTourModal() {
	useModalStore.setState({ modal: "freeTour" });
}

export function closeModal() {
	useModalStore.setState(initialState);
}
