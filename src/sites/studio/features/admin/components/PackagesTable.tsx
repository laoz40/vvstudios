import { useEffect, useMemo, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "#/components/ui/table";
import { cn } from "#/lib/utils";
import {
	CopyableText,
	SortHeaderButton,
	formatInstagramHandle
} from "#studio/features/admin/components/AdminDashboardTableUtils";
import { PackageActions } from "#studio/features/admin/components/PackageActions";
import { StatusIcon } from "#studio/features/admin/components/StatusIcon";
import { PackagesTableFilters } from "#studio/features/admin/components/PackagesTableFilters";
import {
	filterAdminPackages,
	getAdminPackageDashboardDate,
	getAdminPackageStatusDisplay,
	isAdminPackagePaymentDueClose,
	isAdminPackageExpiryClose,
	isAdminPackageExpired,
	isAdminPackageOverdue,
	mapPackageToAdminRow,
	sortAdminPackages,
	type AdminPackageFilters,
	type AdminPackageRecord,
	type AdminPackageRow,
	type AdminPackageSort
} from "#studio/features/admin/lib/admin-packages";
import {
	readStoredPackageTableFilters,
	storePackageTableFilters
} from "#studio/features/admin/lib/admin-dashboard-preferences";
import { formatEditingAddonLabel } from "#studio/features/booking-form/lib/editing-addon-quantities";
import {
	formatShortMonthFullDate,
	formatBookingRelativeDate,
	formatBookingTimestampTime,
	getSydneyDateValue
} from "#studio/lib/bookingdatetime";

type PackageCheckboxFilterKey = Exclude<keyof AdminPackageFilters, "searchQuery">;

function PackageTableDateCell({
	isPastDue,
	packageRow
}: {
	isPastDue: boolean;
	packageRow: AdminPackageRow;
}) {
	const dashboardDate = getAdminPackageDashboardDate(packageRow);
	const isPaymentDueClose = isAdminPackagePaymentDueClose(packageRow);
	const isExpiryClose = isAdminPackageExpiryClose(packageRow);
	const relativeDateLabel =
		dashboardDate.kind === "missing_package_expiry"
			? null
			: formatBookingRelativeDate(getSydneyDateValue(new Date(dashboardDate.timestamp)));

	switch (dashboardDate.kind) {
		case "adjustment_due":
			return (
				<div className="flex flex-col gap-1">
					<span
						className={cn(
							"cursor-help",
							isPastDue ? "text-destructive" : isPaymentDueClose && "text-primary"
						)}
						title={relativeDateLabel ?? undefined}>
						{formatShortMonthFullDate(dashboardDate.timestamp)}
					</span>
					<span className="text-xs text-muted-foreground">Adjustment due</span>
				</div>
			);

		case "payment_due":
			return (
				<div className="flex flex-col gap-1">
					<span
						className={cn(
							"cursor-help",
							isPastDue ? "text-destructive" : isPaymentDueClose && "text-primary"
						)}
						title={relativeDateLabel ?? undefined}>
						{formatShortMonthFullDate(dashboardDate.timestamp)}
					</span>
					<span className="text-xs text-muted-foreground">Payment due</span>
				</div>
			);

		case "package_expiry":
			return (
				<div className="flex flex-col gap-1">
					<span
						className={cn(
							"cursor-help",
							isPastDue ? "text-destructive" : isExpiryClose && "text-primary"
						)}
						title={relativeDateLabel ?? undefined}>
						{formatShortMonthFullDate(dashboardDate.timestamp)}
					</span>
					<span className="text-xs text-muted-foreground">Package expiry</span>
				</div>
			);

		case "missing_package_expiry":
			return <span className="text-muted-foreground">Expiry not set</span>;

		default: {
			const _exhaustive: never = dashboardDate;
			return _exhaustive;
		}
	}
}

export function PackagesTable({
	canLoadMorePackages,
	isLoadingMorePackages,
	loadMorePackages,
	onViewPackageSessions,
	packages
}: {
	canLoadMorePackages: boolean;
	isLoadingMorePackages: boolean;
	loadMorePackages: () => void;
	onViewPackageSessions: (invoiceNumber: string) => void;
	packages: AdminPackageRecord[];
}) {
	// Package filters
	const [filters, setFilters] = useState<AdminPackageFilters>(() => {
		return readStoredPackageTableFilters();
	});
	const [sort, setSort] = useState<AdminPackageSort>({ column: "created", isDescending: true });
	const { showArchived, showOverdue, showPaid, showUpcoming } = filters;

	// Persist package filters.
	useEffect(() => {
		storePackageTableFilters({
			showArchived,
			showOverdue,
			showPaid,
			showUpcoming,
			searchQuery: ""
		});
	}, [showArchived, showOverdue, showPaid, showUpcoming]);

	// Visible package rows after dashboard-level filters.
	const visiblePackages = useMemo(() => {
		const rows = filterAdminPackages(packages.map(mapPackageToAdminRow), filters);
		return sortAdminPackages(rows, sort);
	}, [filters, packages, sort]);

	function updateSort(column: AdminPackageSort["column"]) {
		setSort((currentSort) => ({
			column,
			isDescending:
				currentSort.column === column ? !currentSort.isDescending : column !== "customer"
		}));
	}

	function updateFilter(key: PackageCheckboxFilterKey, checked: boolean) {
		setFilters((currentFilters) => {
			if (key === "showOverdue" && checked) {
				return { ...currentFilters, showOverdue: true, showUpcoming: false };
			}

			if (key === "showUpcoming" && checked) {
				return { ...currentFilters, showOverdue: false, showUpcoming: true };
			}

			return { ...currentFilters, [key]: checked };
		});
	}

	function updateSearchQuery(searchQuery: string) {
		setFilters((currentFilters) => ({ ...currentFilters, searchQuery }));
	}

	return (
		<section className="flex flex-col gap-4">
			<PackagesTableFilters
				filters={filters}
				onFilterChange={updateFilter}
				onSearchQueryChange={updateSearchQuery}
			/>

			<div className="overflow-x-auto border-y">
				<Table className="w-full min-w-7xl table-fixed">
					<TableHeader>
						<TableRow>
							<TableHead className="w-16 md:w-5 text-center">Status</TableHead>
							<TableHead className="w-36">
								<SortHeaderButton
									label="Customer"
									isActive={sort.column === "customer"}
									isDescending={sort.isDescending}
									onClick={() => updateSort("customer")}
								/>
							</TableHead>
							<TableHead className="w-28 md:w-12">Package</TableHead>
							<TableHead className="w-32">Add-ons (Fixed)</TableHead>
							<TableHead className="w-56 md:w-36">Contact</TableHead>
							<TableHead className="w-12">Due / Expiry</TableHead>
							<TableHead className="w-8 text-right">Amount</TableHead>
							<TableHead className="w-28 md:w-12">
								<SortHeaderButton
									label="Created"
									isActive={sort.column === "created"}
									isDescending={sort.isDescending}
									onClick={() => updateSort("created")}
								/>
							</TableHead>
							<TableHead className="w-12 md:w-4" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{visiblePackages.length > 0 ? (
							visiblePackages.map((packageRow) => {
								const isOverdue = isAdminPackageOverdue(packageRow);
								const isExpired = isAdminPackageExpired(packageRow);
								const isInactivePackage = isOverdue || isExpired;
								const dashboardDate = getAdminPackageDashboardDate(packageRow);
								const isDashboardDateOutstanding =
									dashboardDate.kind !== "adjustment_due" ||
									packageRow.adjustment?.paymentStatus === "unpaid";
								const isDashboardDatePastDue =
									dashboardDate.kind !== "missing_package_expiry" &&
									isDashboardDateOutstanding &&
									Date.now() > dashboardDate.timestamp;
								const packageStatusDisplay = getAdminPackageStatusDisplay(packageRow);

								return (
									<TableRow
										key={packageRow.id}
										className={cn(isInactivePackage && "text-muted-foreground")}>
										<TableCell className={cn("text-center", isInactivePackage && "opacity-70")}>
											<div className="flex justify-center">
												<StatusIcon {...packageStatusDisplay} />
											</div>
										</TableCell>
										<TableCell className={cn(isInactivePackage && "opacity-70")}>
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
										<TableCell className={cn(isInactivePackage && "opacity-70")}>
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
										<TableCell
											className={cn(
												"min-w-48 whitespace-normal",
												isInactivePackage && "opacity-70"
											)}>
											{packageRow.addons.length > 0 ? (
												<div className="flex flex-wrap gap-1">
													{packageRow.addons.map((addon) => (
														<Badge
															key={addon}
															variant="outline">
															{formatEditingAddonLabel(addon, packageRow)}
														</Badge>
													))}
												</div>
											) : (
												<p className="text-sm text-muted-foreground">No add-ons</p>
											)}
										</TableCell>
										<TableCell className={cn(isInactivePackage && "opacity-70")}>
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
										<TableCell className={cn(isInactivePackage && "opacity-70")}>
											<PackageTableDateCell
												packageRow={packageRow}
												isPastDue={isDashboardDatePastDue}
											/>
										</TableCell>
										<TableCell
											className={cn("tabular-nums text-right", isInactivePackage && "opacity-70")}>
											<div className="flex flex-col gap-1">
												<p className={packageRow.isPaid ? "text-green" : "text-destructive"}>
													{packageRow.totalDueLabel}
												</p>
												{packageRow.adjustment ? (
													<p
														className={
															packageRow.adjustment.paymentStatus === "paid"
																? "text-green"
																: "text-destructive"
														}>
														{packageRow.adjustment.amountLabel}
													</p>
												) : null}
											</div>
										</TableCell>
										<TableCell className={cn(isInactivePackage && "opacity-70")}>
											<div className="flex flex-col gap-1 whitespace-normal">
												<p className="font-medium">
													{formatShortMonthFullDate(packageRow.createdAt)}
												</p>
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
							})
						) : (
							<TableRow>
								<TableCell
									colSpan={9}
									className="h-24 text-center text-muted-foreground">
									No packages. L business.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{canLoadMorePackages || isLoadingMorePackages ? (
				<div className="flex justify-end">
					<Button
						variant="outline"
						size="sm"
						onClick={loadMorePackages}
						disabled={isLoadingMorePackages}>
						{isLoadingMorePackages ? "Loading..." : "Load more"}
					</Button>
				</div>
			) : null}
		</section>
	);
}
