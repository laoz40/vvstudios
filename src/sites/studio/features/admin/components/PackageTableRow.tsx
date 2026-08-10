import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { TableCell, TableRow } from "#/components/ui/table";
import { cn } from "#/lib/utils";
import {
	CopyableText,
	formatDashboardAddonLabel,
	formatInstagramHandle
} from "#studio/features/admin/components/AdminDashboardTableUtils";
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
		case "payment_due":
			return "Payment due";
		case "package_expiry":
			return "Package expiry";
		case "missing_package_expiry":
			return "Expiry not set";
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
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

function hasOutstandingPackagePayment(packageRow: AdminPackageRow) {
	if (!packageRow.isPaid) {
		return true;
	}

	return packageRow.adjustment?.paymentStatus === "unpaid";
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
			isInactive && !hasOutstandingPackagePayment(packageRow) ? "opacity-70" : undefined,
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
						<CopyableText
							value={packageRow.customerName}
							label="customer name">
							{packageRow.customerName}
						</CopyableText>
					</p>
					{packageRow.accountName || packageRow.abn ? (
						<p className="text-sm">
							{packageRow.accountName ? (
								<CopyableText
									value={packageRow.accountName}
									label="account name">
									{packageRow.accountName}
								</CopyableText>
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
					<p className="break-all font-medium">
						<CopyableText
							value={packageRow.customerEmail}
							label="email">
							{packageRow.customerEmail}
						</CopyableText>
					</p>
					<p className="text-sm">
						<CopyableText
							value={packageRow.customerPhone}
							label="phone number">
							{packageRow.customerPhone}
						</CopyableText>
						{packageRow.instagramHandle ? (
							<>
								{" · "}
								<CopyableText
									value={formatInstagramHandle(packageRow.instagramHandle)}
									label="Instagram handle">
									{formatInstagramHandle(packageRow.instagramHandle)}
								</CopyableText>
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
			<TableCell className={cn("tabular-nums text-right", amountCellClassName)}>
				<div className="flex flex-col gap-1">
					<p className={packageRow.isPaid ? "text-green" : "text-destructive"}>
						{packageRow.totalDueLabel}
					</p>
					{packageRow.adjustment ? (
						<p
							className={
								packageRow.adjustment.paymentStatus === "paid" ? "text-green" : "text-destructive"
							}>
							{packageRow.adjustment.amountLabel}
						</p>
					) : null}
				</div>
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
