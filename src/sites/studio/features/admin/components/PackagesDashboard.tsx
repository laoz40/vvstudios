import { useMemo, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { PackageActions } from "#studio/features/admin/components/PackageActions";
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

import type { Doc } from "#convex/_generated/dataModel";
import {
	filterAdminPackages,
	getAdminPackageDashboardDate,
	getAdminPackageStatusLabel,
	isAdminPackageOverdue,
	mapPackageToAdminRow,
	type AdminPackageFilters,
	type AdminPackageRow,
	type AdminPackageStatus
} from "#studio/features/admin/lib/admin-packages";
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

function PackageFilterCheckbox({
	checked,
	id,
	label,
	onCheckedChange
}: {
	checked: boolean;
	id: string;
	label: string;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-center gap-2">
			<Checkbox
				id={id}
				checked={checked}
				onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
			/>
			<Label
				htmlFor={id}
				className="text-sm font-medium text-foreground">
				{label}
			</Label>
		</div>
	);
}

function PackageDashboardDateCell({
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

export function PackagesDashboard({
	canLoadMorePackages,
	isLoadingMorePackages,
	loadMorePackages,
	packages
}: {
	canLoadMorePackages: boolean;
	isLoadingMorePackages: boolean;
	loadMorePackages: () => void;
	packages: Doc<"multiBookingPackages">[];
}) {
	// Package filters
	const [filters, setFilters] = useState<AdminPackageFilters>({
		hideHidden: false,
		hidePaid: false,
		hideOverdue: false,
		hideEmailIssues: false,
		searchQuery: ""
	});

	// Visible package rows after dashboard-level filters. The backend returns newest first.
	const visiblePackages = useMemo(() => {
		const rows = packages.map(mapPackageToAdminRow);
		return filterAdminPackages(rows, filters).sort((firstPackage, secondPackage) => {
			const createdComparison = firstPackage.createdAt - secondPackage.createdAt;

			if (createdComparison !== 0) {
				return -createdComparison;
			}

			return firstPackage.customerName.localeCompare(secondPackage.customerName);
		});
	}, [filters, packages]);

	function updateFilter(key: PackageCheckboxFilterKey, checked: boolean) {
		setFilters((currentFilters) => ({ ...currentFilters, [key]: checked }));
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
					<PackageFilterCheckbox
						id="hide-paid-packages"
						label="Hide paid"
						checked={filters.hidePaid}
						onCheckedChange={(checked) => updateFilter("hidePaid", checked)}
					/>
					<PackageFilterCheckbox
						id="hide-overdue-packages"
						label="Hide overdue"
						checked={filters.hideOverdue}
						onCheckedChange={(checked) => updateFilter("hideOverdue", checked)}
					/>
					<PackageFilterCheckbox
						id="hide-hidden-packages"
						label="Hide archived"
						checked={filters.hideHidden}
						onCheckedChange={(checked) => updateFilter("hideHidden", checked)}
					/>
					<PackageFilterCheckbox
						id="hide-email-issue-packages"
						label="Hide errors"
						checked={filters.hideEmailIssues}
						onCheckedChange={(checked) => updateFilter("hideEmailIssues", checked)}
					/>
				</div>
			</div>

			<div className="overflow-x-auto border-y">
				<Table className="min-w-7xl table-fixed">
					<TableHeader>
						<TableRow>
							<TableHead className="w-44">Customer</TableHead>
							<TableHead className="w-28">Status</TableHead>
							<TableHead className="w-28">Package</TableHead>
							<TableHead className="w-44">Service</TableHead>
							<TableHead className="w-44">Contact</TableHead>
							<TableHead className="w-54">Notes</TableHead>
							<TableHead className="w-28">Due / Expiry</TableHead>
							<TableHead className="w-24">Amount</TableHead>
							<TableHead className="w-32">
								<Button
									variant="ghost"
									className="px-0! text-foreground">
									<span>Created</span>
									<ArrowDown
										data-icon="inline-end"
										className="opacity-100"
									/>
								</Button>
							</TableHead>
							<TableHead className="w-6" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{visiblePackages.length > 0 ? (
							visiblePackages.map((packageRow) => {
								const isOverdue = isAdminPackageOverdue(packageRow);

								return (
									<TableRow key={packageRow.id}>
										<TableCell>
											<p className="font-medium text-foreground">{packageRow.customerName}</p>
										</TableCell>
										<TableCell>
											<div className="flex flex-wrap gap-2">
												<Badge className={cn(statusBadgeClassNames[packageRow.status])}>
													{getAdminPackageStatusLabel(packageRow.status)}
												</Badge>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex flex-col gap-1">
												<p className="font-medium text-foreground">
													{packageRow.packageSize} sessions
												</p>
												<p className="text-sm text-muted-foreground">
													{packageRow.bookedSessions} / {packageRow.packageSize} booked
												</p>
											</div>
										</TableCell>
										<TableCell>
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
										<TableCell>
											<div className="flex flex-col gap-1 whitespace-normal">
												<p className="break-all font-medium">{packageRow.customerEmail}</p>
												<p className="text-sm">{packageRow.customerPhone}</p>
											</div>
										</TableCell>
										<TableCell>
											<p className="whitespace-normal text-sm text-muted-foreground">
												{packageRow.notes?.trim() || "No notes"}
											</p>
										</TableCell>
										<TableCell>
											<PackageDashboardDateCell
												packageRow={packageRow}
												isOverdue={isOverdue}
											/>
										</TableCell>
										<TableCell>
											<p className={packageRow.isPaid ? "text-green" : "text-destructive"}>
												{packageRow.totalDueLabel}
											</p>
										</TableCell>
										<TableCell>
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
