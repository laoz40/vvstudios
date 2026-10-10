import { useState, type Dispatch, type SetStateAction } from "react";
import { useQuery } from "convex/react";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { AdminPackagePendingAction } from "#studio/features/admin/lib/admin-packages";
import { getStripeBillingInvoicesState } from "#studio/features/admin/lib/stripe-invoice-billing";

type SetPackagePendingAction = Dispatch<SetStateAction<AdminPackagePendingAction>>;

export type PackageInvoiceTarget = { packageId: Id<"packages">; stripeCustomerId?: string };

export function usePackageInvoiceActions(
	packageTarget: PackageInvoiceTarget | null,
	_setPendingAction?: SetPackagePendingAction
) {
	const [isStripeBillingDialogOpen, setIsStripeBillingDialogOpen] = useState(false);

	const stripeInvoicesResult = useQuery(
		api.stripe.invoiceRecords.listStripeInvoicesForPackage,
		packageTarget ? { packageId: packageTarget.packageId } : "skip"
	);

	const { hasStripeBillingInvoices, stripeBillingInvoices } = getStripeBillingInvoicesState(
		stripeInvoicesResult,
		isStripeBillingDialogOpen
	);

	return {
		hasStripeBillingInvoices,
		hasStripeCustomer: Boolean(packageTarget?.stripeCustomerId),
		isStripeBillingDialogOpen,
		setIsStripeBillingDialogOpen,
		stripeBillingInvoices
	};
}
