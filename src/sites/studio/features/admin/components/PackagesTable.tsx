import { useEffect, useMemo, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "#/components/ui/table";
import { SortHeaderButton } from "#studio/features/admin/components/AdminDashboardTableUtils";
import { PackageTableRow } from "#studio/features/admin/components/PackageTableRow";
import { PackagesTableFilters } from "#studio/features/admin/components/PackagesTableFilters";
import {
	filterAdminPackages,
	mapPackageToAdminRow,
	sortAdminPackages,
	type AdminPackageFilters,
	type AdminPackageRecord,
	type AdminPackageSort
} from "#studio/features/admin/lib/admin-packages";
import {
	readStoredPackageTableFilters,
	storePackageTableFilters
} from "#studio/features/admin/lib/admin-dashboard-preferences";

type PackageCheckboxFilterKey = Exclude<keyof AdminPackageFilters, "searchQuery">;

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
					<colgroup>
						<col className="w-8 md:w-6" />
						<col className="w-42 md:w-36" />
						<col className="w-20 md:w-16" />
						<col className="w-36 md:w-28" />
						<col className="w-48" />
						<col className="w-16 md:w-12" />
						<col className="w-20 md:w-8" />
						<col className="w-20 md:w-12" />
						<col className="w-6" />
					</colgroup>
					<TableHeader>
						<TableRow>
							<TableHead className="text-center">Status</TableHead>
							<TableHead>
								<SortHeaderButton
									label="Customer"
									isActive={sort.column === "customer"}
									isDescending={sort.isDescending}
									onClick={() => updateSort("customer")}
								/>
							</TableHead>
							<TableHead>Package</TableHead>
							<TableHead>Add-ons (Fixed)</TableHead>
							<TableHead>Contact</TableHead>
							<TableHead>Due / Expiry</TableHead>
							<TableHead className="text-right">Amount</TableHead>
							<TableHead>
								<SortHeaderButton
									label="Created"
									isActive={sort.column === "created"}
									isDescending={sort.isDescending}
									onClick={() => updateSort("created")}
								/>
							</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{visiblePackages.length > 0 ? (
							visiblePackages.map((packageRow) => (
								<PackageTableRow
									key={packageRow.id}
									onViewPackageSessions={onViewPackageSessions}
									packageRow={packageRow}
								/>
							))
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
