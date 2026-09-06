import { useState } from "react";
import type {
	AdminPackagePendingAction,
	AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";
import { usePackageAdjustmentActions } from "#studio/features/admin/hooks/usePackageAdjustmentActions";
import { usePackageEditAction } from "#studio/features/admin/hooks/usePackageEditAction";
import { usePackageInvoiceActions } from "#studio/features/admin/hooks/usePackageInvoiceActions";
import { usePackagePaymentActions } from "#studio/features/admin/hooks/usePackagePaymentActions";

export function usePackageActions(packageRow: AdminPackageRow) {
	const [pendingAction, setPendingAction] = useState<AdminPackagePendingAction>(null);
	const editAction = usePackageEditAction(packageRow);
	const invoiceActions = usePackageInvoiceActions(packageRow, setPendingAction);
	const paymentActions = usePackagePaymentActions(packageRow, setPendingAction);
	const adjustmentActions = usePackageAdjustmentActions(packageRow, setPendingAction);

	const isActionPending = pendingAction !== null;

	return {
		editAction,
		...adjustmentActions,
		...invoiceActions,
		...paymentActions,
		isActionPending,
		pendingAction
	};
}
