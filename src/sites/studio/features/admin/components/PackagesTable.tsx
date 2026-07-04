import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Doc } from "#convex/_generated/dataModel";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
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
	formatInstagramHandle
} from "#studio/features/admin/components/AdminDashboardTableUtils";
import { PackageActions } from "#studio/features/admin/components/PackageActions";

import {
	filterAdminPackages,
	getAdminPackageDashboardDate,
	getAdminPackageStatusLabel,
	isAdminPackageExpired,
	isAdminPackageOverdue,
	mapPackageToAdminRow,
	type AdminPackageFilters,
	type AdminPackageRow,
	type AdminPackageStatus
} from "#studio/features/admin/lib/admin-packages";
import {
	readStoredPackageTableFilters,
	storePackageTableFilters
} from "#studio/features/admin/lib/admin-dashboard-preferences";
import { formatEditingAddonLabel } from "#studio/features/booking-form/lib/editing-addon-quantities";
import {
	formatBookingTimestamp,
	formatBookingTimestampDateLong
} from "#studio/lib/bookingdatetime";

type PackageCheckboxFilterKey = Exclude<keyof AdminPackageFilters, "searchQuery">;

const statusBadgeClassNames: Record<AdminPackageStatus, string> = {
	pending_payment: "bg-primary text-primary-foreground",
	invoice_email_failed: "bg-destructive text-primary-foreground",
	paid: "bg-green text-primary-foreground",
	schedule_email_failed: "bg-destructive text-primary-foreground"
};

function PackageTableDateCell({
	isOverdue,
	packageRow
}: {
	isOverdue: boolean;
	packageRow: AdminPackageRow;
}) {
	const dashboardDate = getAdminPackageDashboardDate(packageRow);

	switch (dashboardDate.kind) {
		case "payment_due":
			return (
				<div className="flex flex-col gap-1">
					<span>{formatBookingTimestampDateLong(dashboardDate.timestamp)}</span>
					<span className="text-xs text-muted-foreground">Payment due</span>
					{isOverdue ? <Badge variant="destructive">Overdue</Badge> : null}
				</div>
			);

		case "package_expiry":
			return (
				<div className="flex flex-col gap-1">
					<span>{formatBookingTimestampDateLong(dashboardDate.timestamp)}</span>
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
	packages: Doc<"multiBookingPackages">[];
}) {
	// Package filters
	const [filters, setFilters] = useState<AdminPackageFilters>(() => {
		return readStoredPackageTableFilters();
	});
	const [isCreatedSortDescending, setIsCreatedSortDescending] = useState(true);
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
		const rows = packages.map(mapPackageToAdminRow);
		return filterAdminPackages(rows, filters).sort((firstPackage, secondPackage) => {
			const createdComparison = firstPackage.createdAt - secondPackage.createdAt;

			if (createdComparison !== 0) {
				return isCreatedSortDescending ? -createdComparison : createdComparison;
			}

			return firstPackage.customerName.localeCompare(secondPackage.customerName);
		});
	}, [filters, isCreatedSortDescending, packages]);

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
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<Input
					placeholder="Search packages..."
					value={filters.searchQuery}
					onChange={(event) => updateSearchQuery(event.target.value)}
					className="w-full md:w-sm"
				/>
				<div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-end">
					<div className="flex items-center gap-2">
						<Checkbox
							id="show-paid-packages"
							checked={filters.showPaid}
							onCheckedChange={(checked) => updateFilter("showPaid", checked === true)}
						/>
						<Label
							htmlFor="show-paid-packages"
							className="text-sm font-medium text-foreground">
							Paid only
						</Label>
					</div>
					<div className="flex items-center gap-2">
						<Checkbox
							id="show-overdue-packages"
							checked={filters.showOverdue}
							onCheckedChange={(checked) => updateFilter("showOverdue", checked === true)}
						/>
						<Label
							htmlFor="show-overdue-packages"
							className="text-sm font-medium text-foreground">
							Overdue only
						</Label>
					</div>
					<div className="flex items-center gap-2">
						<Checkbox
							id="show-upcoming-packages"
							checked={filters.showUpcoming}
							onCheckedChange={(checked) => updateFilter("showUpcoming", checked === true)}
						/>
						<Label
							htmlFor="show-upcoming-packages"
							className="text-sm font-medium text-foreground">
							Upcoming only
						</Label>
					</div>
					<div className="flex items-center gap-2">
						<Checkbox
							id="show-archived-packages"
							checked={filters.showArchived}
							onCheckedChange={(checked) => updateFilter("showArchived", checked === true)}
						/>
						<Label
							htmlFor="show-archived-packages"
							className="text-sm font-medium text-foreground">
							Show archived
						</Label>
					</div>
				</div>
			</div>

			<div className="overflow-x-auto border-y">
				<Table className="min-w-7xl table-fixed">
					<TableHeader>
						<TableRow>
							<TableHead className="w-48">Customer</TableHead>
							<TableHead className="w-28">Status</TableHead>
							<TableHead className="w-20">Package</TableHead>
							<TableHead className="w-44">Service</TableHead>
							<TableHead className="w-56">Contact</TableHead>
							<TableHead className="w-48">Notes</TableHead>
							<TableHead className="w-28">Due / Expiry</TableHead>
							<TableHead className="w-20">Amount</TableHead>
							<TableHead className="w-28">
								<Button
									variant="ghost"
									className="px-0! text-foreground"
									onClick={() => setIsCreatedSortDescending((isDescending) => !isDescending)}>
									<span>Created</span>
									{isCreatedSortDescending ? (
										<ArrowDown
											data-icon="inline-end"
											className="opacity-100"
										/>
									) : (
										<ArrowUp
											data-icon="inline-end"
											className="opacity-100"
										/>
									)}
								</Button>
							</TableHead>
							<TableHead className="w-8" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{visiblePackages.length > 0 ? (
							visiblePackages.map((packageRow) => {
								const isOverdue = isAdminPackageOverdue(packageRow);
								const isInactivePackage = isOverdue || isAdminPackageExpired(packageRow);
								const packageInvoiceNumber = packageRow.invoiceNumber;

								return (
									<TableRow
										key={packageRow.id}
										className={cn(isInactivePackage && "text-muted-foreground")}>
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
											<div className="flex flex-wrap gap-2">
												<Badge className={cn(statusBadgeClassNames[packageRow.status])}>
													{getAdminPackageStatusLabel(packageRow.status)}
												</Badge>
											</div>
										</TableCell>
										<TableCell className={cn(isInactivePackage && "opacity-70")}>
											{packageInvoiceNumber ? (
												<Button
													type="button"
													variant="link"
													className="h-auto flex-col items-start gap-1 p-0 text-left"
													onClick={() => onViewPackageSessions(packageInvoiceNumber)}>
													<span className="font-medium text-foreground">
														{packageRow.packageSize} sessions
													</span>
													<span className="text-sm text-muted-foreground">
														{packageRow.bookedSessions} / {packageRow.packageSize} booked
													</span>
												</Button>
											) : (
												<div className="flex flex-col gap-1">
													<p className="font-medium text-foreground">
														{packageRow.packageSize} sessions
													</p>
													<p className="text-sm text-muted-foreground">
														{packageRow.bookedSessions} / {packageRow.packageSize} booked
													</p>
												</div>
											)}
										</TableCell>
										<TableCell className={cn(isInactivePackage && "opacity-70")}>
											<div className="flex min-w-48 flex-col gap-2 whitespace-normal">
												<p className="font-medium">
													{packageRow.service} ({packageRow.duration})
												</p>
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
											</div>
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
											<p className="whitespace-normal text-sm text-muted-foreground">
												{packageRow.notes?.trim() || "No notes"}
											</p>
										</TableCell>
										<TableCell className={cn(isInactivePackage && "opacity-70")}>
											<PackageTableDateCell
												packageRow={packageRow}
												isOverdue={isOverdue}
											/>
										</TableCell>
										<TableCell className={cn(isInactivePackage && "opacity-70")}>
											<p className={packageRow.isPaid ? "text-green" : "text-destructive"}>
												{packageRow.totalDueLabel}
											</p>
										</TableCell>
										<TableCell className={cn(isInactivePackage && "opacity-70")}>
											<p className="font-medium whitespace-normal">
												{formatBookingTimestamp(packageRow.createdAt)}
											</p>
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
									colSpan={10}
									className="h-24 text-center text-muted-foreground">
									No package requests. L business.
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
