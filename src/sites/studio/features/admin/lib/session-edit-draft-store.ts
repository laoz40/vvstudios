import { Store } from "@tanstack/react-store";
import { createContext, useContext } from "react";
import type { Doc } from "#convex/_generated/dataModel";
import {
	toDeliverableCountOption,
	type BookingAddonQuantities,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import { toAdminSessionDuration } from "#studio/features/admin/lib/admin-sessions";

type SessionRecord = Doc<"bookings">;

export type SessionEditDraft = {
	accountName: string;
	addons: BookingFormValues["addons"];
	abn: string;
	date: string;
} & BookingAddonQuantities & {
		duration: BookingFormValues["duration"];
		email: string;
		name: string;
		notes: string;
		phone: string;
		service: SessionRecord["service"];
		time: string;
	};

export type SessionEditDraftStore = Store<SessionEditDraft>;

export const SessionEditDraftStoreContext = createContext<SessionEditDraftStore | null>(null);

export function useSessionEditDraftStore() {
	const store = useContext(SessionEditDraftStoreContext);

	if (!store) {
		throw new Error("useSessionEditDraftStore must be used within SessionEditDraftStoreContext");
	}

	return store;
}

export function buildSessionEditDraft(session: SessionRecord): SessionEditDraft {
	return {
		name: session.name,
		accountName: session.accountName,
		abn: session.abn ?? "",
		date: session.date,
		essentialEditQuantity: toDeliverableCountOption(session.essentialEditQuantity),
		completeEditQuantity: toDeliverableCountOption(session.completeEditQuantity),
		clipsPackageQuantity: toDeliverableCountOption(session.clipsPackageQuantity),
		handcraftedClipsQuantity: toDeliverableCountOption(session.handcraftedClipsQuantity),
		time: session.time,
		duration: toAdminSessionDuration(session.duration),
		service: session.service,
		addons: [...session.addons],
		email: session.email,
		phone: session.phone,
		notes: session.notes ?? ""
	};
}

export function setSessionEditDraftField<K extends keyof SessionEditDraft>(
	store: SessionEditDraftStore,
	field: K,
	value: SessionEditDraft[K]
) {
	store.setState((current) => ({ ...current, [field]: value }));
}
