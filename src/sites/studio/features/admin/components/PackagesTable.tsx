import { useEffect, useMemo, useState } from "react";
import { TableCell, TableRow } from "#/components/ui/table";
import { FixedDataTable } from "#studio/components/FixedDataTable";
import { SortHeaderButton } from "#studio/features/admin/components/AdminDashboardTableUtils";
import { PackageTableRow } from "#studio/features/admin/components/PackageTableRow";
import { PackagesTableFilters } from "#studio/features/admin/components/PackagesTableFilters";
import {
	filterAdminPackages,
	mapPackageToAdminRow,
	type AdminPackageFilters,
	type AdminPackageRecord,
	type AdminPackageSort
} from "#studio/features/admin/lib/admin-packages";
import {
	readStoredPackageTableFilters,
	storePackageTableFilters
} from "#studio/features/admin/lib/admin-dashboard-preferences";
import { InfiniteScrollSentinel } from "#studio/components/InfiniteScrollSentinel";

type PackageCheckboxFilterKey = Exclude<keyof AdminPackageFilters, "searchQuery">;

export function PackagesTable({
	canLoadMorePackages,
	isLoadingMorePackages,
	isLoadingPackages,
	loadMorePackages,
	onSortingChange,
	onViewPackageSessions,
	packages,
	sorting
}: {
	canLoadMorePackages: boolean;
	isLoadingMorePackages: boolean;
	isLoadingPackages: boolean;
	loadMorePackages: () => void;
	onSortingChange: (sorting: AdminPackageSort) => void;
	onViewPackageSessions: (invoiceNumber: string) => void;
	packages: AdminPackageRecord[];
	sorting: AdminPackageSort;
}) {
	// Package filters
	const [filters, setFilters] = useState<AdminPackageFilters>(() => {
		return readStoredPackageTableFilters();
	});

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
		return filterAdminPackages(packages.map(mapPackageToAdminRow), filters);
	}, [filters, packages]);

	function updateCreatedSort() {
		onSortingChange({ isDescending: !sorting.isDescending });
		window.scrollTo({ top: 0 });
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
				<FixedDataTable
					minWidthClassName="min-w-7xl"
					columns={[
						{
							key: "status",
							colClassName: "w-8 md:w-6",
							header: "Status",
							headerClassName: "text-center"
						},
						{ key: "customer", colClassName: "w-42 md:w-36", header: "Customer" },
						{ key: "package", colClassName: "w-20 md:w-16", header: "Package" },
						{ key: "addons", colClassName: "w-36 md:w-28", header: "Add-ons (Fixed)" },
						{ key: "contact", colClassName: "w-48", header: "Contact" },
						{ key: "due", colClassName: "w-16 md:w-12", header: "Due / Expiry" },
						{
							key: "amount",
							colClassName: "w-20 md:w-8",
							header: "Amount",
							headerClassName: "text-right"
						},
						{
							key: "created",
							colClassName: "w-20 md:w-12",
							header: (
								<SortHeaderButton
									label="Created"
									isActive
									isDescending={sorting.isDescending}
									isLoading={isLoadingPackages}
									onClick={updateCreatedSort}
								/>
							)
						},
						{ key: "actions", colClassName: "w-6", header: null }
					]}>
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
				</FixedDataTable>
			</div>

			<InfiniteScrollSentinel
				canLoadMore={!isLoadingPackages && canLoadMorePackages}
				isLoadingMore={isLoadingMorePackages}
				onLoadMore={loadMorePackages}
			/>
		</section>
	);
}
