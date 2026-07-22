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
