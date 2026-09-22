import { Store } from "@tanstack/react-store";
import { createContext, useContext } from "react";
import {
	toDeliverableCountOption,
	type BookingAddonQuantities,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import type { PackageSize } from "#studio/features/booking-form/lib/booking-pricing";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import { toAdminSessionDuration } from "#studio/features/admin/lib/admin-sessions";
import { getSydneyDateValue, getSydneyTimeValue } from "#studio/lib/bookingdatetime";

export type PackageEditDraft = {
	accountName: string;
	addons: BookingFormValues["addons"];
	abn: string;
	customerEmail: string;
	customerName: string;
	customerPhone: string;
	duration: BookingFormValues["duration"];
	expiresDate: string;
	expiresTime: string;
	notes: string;
	packageSize: PackageSize;
} & BookingAddonQuantities;

export type PackageEditDraftStore = Store<PackageEditDraft>;

export const PackageEditDraftStoreContext = createContext<PackageEditDraftStore | null>(null);

export function usePackageEditDraftStore() {
	const store = useContext(PackageEditDraftStoreContext);

	if (!store) {
		throw new Error("usePackageEditDraftStore must be used within PackageEditDraftStoreContext");
	}

	return store;
}

export function buildPackageEditDraft(packageRow: AdminPackageRow): PackageEditDraft {
	return {
		accountName: packageRow.accountName,
		addons: [...packageRow.addons],
		abn: packageRow.abn ?? "",
		clipsPackageQuantity: toDeliverableCountOption(packageRow.clipsPackageQuantity),
		completeEditQuantity: toDeliverableCountOption(packageRow.completeEditQuantity),
		customerEmail: packageRow.customerEmail,
		customerName: packageRow.customerName,
		customerPhone: packageRow.customerPhone,
		duration: toAdminSessionDuration(packageRow.duration),
		essentialEditQuantity: toDeliverableCountOption(packageRow.essentialEditQuantity),
		handcraftedClipsQuantity: toDeliverableCountOption(packageRow.handcraftedClipsQuantity),
		expiresDate:
			packageRow.expiresAt === undefined ? "" : getSydneyDateValue(new Date(packageRow.expiresAt)),
		expiresTime: packageRow.expiresAt === undefined ? "" : getSydneyTimeValue(packageRow.expiresAt),
		notes: packageRow.notes ?? "",
		packageSize: packageRow.packageSize
	};
}

export function setPackageEditDraftField<K extends keyof PackageEditDraft>(
	store: PackageEditDraftStore,
	field: K,
	value: PackageEditDraft[K]
) {
	store.setState((current) => ({ ...current, [field]: value }));
}
