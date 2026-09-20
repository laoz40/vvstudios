import { Badge } from "#/components/ui/badge";
import { exhaustiveCheck } from "#/lib/result";
import { Button } from "#/components/ui/button";
import { TableCell, TableRow } from "#/components/ui/table";
import { cn } from "#/lib/utils";
import {
	CopyableText,
	formatInstagramHandle
} from "#studio/features/admin/components/AdminDashboardTableUtils";
import { PrivacySensitiveText } from "#studio/features/admin/components/PrivacySensitiveText";
import { formatDashboardAddonLabel } from "#studio/features/booking-form/lib/editing-addon-quantities";
import { PackageActions } from "#studio/features/admin/components/PackageActions";
import { StatusIcon } from "#studio/features/admin/components/StatusIcon";
import {
	getAdminPackageDashboardDate,
	getAdminPackageStatusDisplay,
	isAdminPackagePaymentDueClose,
	isAdminPackageExpiryClose,
	isAdminPackageRowDimmed,
	type AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";
import {
	formatAudAmount,
	getAudAmountRowShowCents
} from "#studio/features/admin/lib/remaining-balance";
import { getStripeInvoiceAmountClassName } from "#studio/features/admin/lib/stripe-invoice-billing";
import {
	formatShortMonthFullDate,
	formatBookingRelativeDate,
	formatBookingTimestampTime,
	getSydneyDateValue
} from "#studio/lib/bookingdatetime";

function getPackageDashboardDateLabel(
	kind: ReturnType<typeof getAdminPackageDashboardDate>["kind"]
): string {
	switch (kind) {
		case "adjustment_due":
			return "Adjustment due";
		case "package_expiry":
			return "Package expiry";
		case "missing_package_expiry":
			return "Expiry not set";
		default:
			return exhaustiveCheck(kind);
	}
}

function PackageTableDateCell({
	isPastDue,
	packageRow
}: {
	isPastDue: boolean;
	packageRow: AdminPackageRow;
}) {
	const dashboardDate = getAdminPackageDashboardDate(packageRow);
	const label = getPackageDashboardDateLabel(dashboardDate.kind);

	if (dashboardDate.kind === "missing_package_expiry") {
		return <span className="text-muted-foreground">{label}</span>;
	}

	const isDueClose =
		dashboardDate.kind === "package_expiry"
			? isAdminPackageExpiryClose(packageRow)
			: isAdminPackagePaymentDueClose(packageRow);

	const relativeDateLabel = formatBookingRelativeDate(
		getSydneyDateValue(new Date(dashboardDate.timestamp))
	);

	return (
		<div className="flex flex-col gap-1">
			<span
				className={cn("cursor-help", isPastDue ? "text-destructive" : isDueClose && "text-primary")}
				title={relativeDateLabel}>
				{formatShortMonthFullDate(dashboardDate.timestamp)}
			</span>
			<span className="text-xs text-muted-foreground">{label}</span>
		</div>
	);
}

function PackageAmountCell({
	packageRow,
	rowId
}: {
	packageRow: AdminPackageRow;
	rowId: AdminPackageRow["id"];
}) {
	const rowAmounts = [
		packageRow.totalDueAmount,
		packageRow.adjustment?.totalAmount,
		packageRow.customStripeInvoices?.totalAmount
	].filter((amount): amount is number => amount !== undefined);

	const showCents = getAudAmountRowShowCents(rowAmounts);

	const totalDueLabel = formatAudAmount(packageRow.totalDueAmount, { showCents });

	const adjustmentLabel = packageRow.adjustment
		? formatAudAmount(packageRow.adjustment.totalAmount, { showCents })
		: null;

	const customStripeInvoiceLabel = packageRow.customStripeInvoices
		? formatAudAmount(packageRow.customStripeInvoices.totalAmount, { showCents })
		: null;

	return (
		<div className="flex flex-col items-end gap-1">
			<p className="text-green">
				<PrivacySensitiveText
					rowId={rowId}
					value={totalDueLabel}
					label="package amount"
					copyable={false}>
					{totalDueLabel}
				</PrivacySensitiveText>
			</p>
			{packageRow.adjustment && adjustmentLabel ? (
				<p
					className={
						packageRow.adjustment.paymentStatus === "paid" ? "text-green" : "text-destructive"
					}>
					<PrivacySensitiveText
						rowId={rowId}
						value={adjustmentLabel}
						label="adjustment amount"
						copyable={false}>
						{adjustmentLabel}
					</PrivacySensitiveText>
				</p>
			) : null}
			{packageRow.customStripeInvoices && customStripeInvoiceLabel ? (
				<p
					className={getStripeInvoiceAmountClassName(
						packageRow.customStripeInvoices.paymentStatus
					)}>
					<PrivacySensitiveText
						rowId={rowId}
						value={customStripeInvoiceLabel}
						label="Stripe invoice amount"
						copyable={false}>
						{customStripeInvoiceLabel}
					</PrivacySensitiveText>
				</p>
			) : null}
		</div>
	);
}

function hasOutstandingStripeInvoice(packageRow: AdminPackageRow) {
	return (
		packageRow.adjustment?.paymentStatus === "unpaid" ||
		packageRow.customStripeInvoices?.paymentStatus === "unpaid"
	);
}

function getAdminPackageTableRowState(packageRow: AdminPackageRow) {
	const isInactive = isAdminPackageRowDimmed(packageRow);
	const dashboardDate = getAdminPackageDashboardDate(packageRow);

	const isDashboardDateOutstanding =
		dashboardDate.kind !== "adjustment_due" || packageRow.adjustment?.paymentStatus === "unpaid";

	const isDashboardDatePastDue =
		dashboardDate.kind !== "missing_package_expiry" &&
		isDashboardDateOutstanding &&
		Date.now() > dashboardDate.timestamp;

	return {
		amountCellClassName:
			isInactive && !hasOutstandingStripeInvoice(packageRow) ? "opacity-70" : undefined,
		dateCellClassName: isInactive && !isDashboardDatePastDue ? "opacity-70" : undefined,
		isDashboardDatePastDue,
		inactiveCellClassName: isInactive ? "opacity-70" : undefined,
		rowClassName: isInactive ? "text-muted-foreground" : undefined
	};
}

export function PackageTableRow({
	onViewPackageSessions,
	packageRow
}: {
	onViewPackageSessions: (invoiceNumber: string) => void;
	packageRow: AdminPackageRow;
}) {
	const {
		amountCellClassName,
		dateCellClassName,
		inactiveCellClassName,
		isDashboardDatePastDue,
		rowClassName
	} = getAdminPackageTableRowState(packageRow);

	const packageStatusDisplay = getAdminPackageStatusDisplay(packageRow);

	return (
		<TableRow
			key={packageRow.id}
			className={rowClassName}>
			<TableCell className={cn("text-center", inactiveCellClassName)}>
				<div className="flex justify-center">
					<StatusIcon {...packageStatusDisplay} />
				</div>
			</TableCell>
			<TableCell className={inactiveCellClassName}>
				<div className="flex flex-col gap-1 whitespace-normal">
					<p className="font-medium text-foreground">
						<PrivacySensitiveText
							rowId={packageRow.id}
							value={packageRow.customerName}
							label="customer name">
							{packageRow.customerName}
						</PrivacySensitiveText>
					</p>
					{packageRow.accountName || packageRow.abn ? (
						<p className="text-sm">
							{packageRow.accountName ? (
								<PrivacySensitiveText
									rowId={packageRow.id}
									value={packageRow.accountName}
									label="account name">
									{packageRow.accountName}
								</PrivacySensitiveText>
							) : null}
							{packageRow.abn ? (
								<>
									{packageRow.accountName ? " · " : ""}
									<CopyableText
										value={packageRow.abn}
										label="ABN">
										ABN
									</CopyableText>
								</>
							) : null}
						</p>
					) : null}
				</div>
			</TableCell>
			<TableCell className={inactiveCellClassName}>
				<Button
					type="button"
					variant="link"
					className="h-auto flex-col items-start gap-1 p-0 text-left"
					onClick={() => onViewPackageSessions(packageRow.invoiceNumber)}>
					<span className="font-medium text-foreground">
						{packageRow.packageSize} sessions ({packageRow.duration})
					</span>
					<span className="text-sm text-muted-foreground">
						{packageRow.bookedSessions} / {packageRow.packageSize} booked
					</span>
				</Button>
			</TableCell>
			<TableCell className={cn("min-w-48 whitespace-normal", inactiveCellClassName)}>
				{packageRow.addons.length > 0 ? (
					<div className="flex flex-wrap gap-1">
						{packageRow.addons.map((addon) => (
							<Badge
								key={addon}
								variant="outline">
								{formatDashboardAddonLabel(addon, packageRow)}
							</Badge>
						))}
					</div>
				) : (
					<p className="text-sm text-muted-foreground">No add-ons</p>
				)}
			</TableCell>
			<TableCell className={inactiveCellClassName}>
				<div className="flex flex-col gap-1 whitespace-normal">
					<p className="font-medium break-all">
						<PrivacySensitiveText
							rowId={packageRow.id}
							value={packageRow.customerEmail}
							label="email">
							{packageRow.customerEmail}
						</PrivacySensitiveText>
					</p>
					<p className="text-sm">
						<PrivacySensitiveText
							rowId={packageRow.id}
							value={packageRow.customerPhone}
							label="phone number">
							{packageRow.customerPhone}
						</PrivacySensitiveText>
						{packageRow.instagramHandle ? (
							<>
								{" · "}
								<PrivacySensitiveText
									rowId={packageRow.id}
									value={formatInstagramHandle(packageRow.instagramHandle)}
									label="Instagram handle">
									{formatInstagramHandle(packageRow.instagramHandle)}
								</PrivacySensitiveText>
							</>
						) : null}
					</p>
				</div>
			</TableCell>
			<TableCell className={dateCellClassName}>
				<PackageTableDateCell
					packageRow={packageRow}
					isPastDue={isDashboardDatePastDue}
				/>
			</TableCell>
			<TableCell className={cn("text-right tabular-nums", amountCellClassName)}>
				<PackageAmountCell
					packageRow={packageRow}
					rowId={packageRow.id}
				/>
			</TableCell>
			<TableCell className={inactiveCellClassName}>
				<div className="flex flex-col gap-1 whitespace-normal">
					<p className="font-medium">{formatShortMonthFullDate(packageRow.createdAt)}</p>
					<p className="text-sm text-muted-foreground">
						{formatBookingTimestampTime(packageRow.createdAt)}
					</p>
				</div>
			</TableCell>
			<TableCell>
				<PackageActions packageRow={packageRow} />
			</TableCell>
		</TableRow>
	);
}
