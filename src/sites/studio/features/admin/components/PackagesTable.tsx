import { useEffect, useMemo, type ReactNode } from "react";
import { TableCell, TableRow } from "#/components/ui/table";
import { FixedDataTable } from "#studio/components/FixedDataTable";
import {
	SortHeaderButton,
	AdminTableLoadingRow
} from "#studio/features/admin/components/AdminDashboardTableUtils";
import { PackageTableRow } from "#studio/features/admin/components/PackageTableRow";
import { PackagesTableFilters } from "#studio/features/admin/components/PackagesTableFilters";
import {
	mapPackageToAdminRow,
	type AdminPackageRecord,
	type AdminPackageSort,
	type AdminPackagesView
} from "#studio/features/admin/lib/admin-packages";
import { storePackagesTableFilters } from "#studio/features/admin/lib/admin-dashboard-preferences";
import { InfiniteScrollSentinel } from "#studio/components/InfiniteScrollSentinel";

export function PackagesTable({
	canLoadMorePackages,
	isLoadingMorePackages,
	isLoadingPackages,
	isSearchBatchPaused,
	loadedSearchMatchCount,
	loadMorePackages,
	onContinueSearchBatchLoading,
	onPackagesViewChange,
	onSearchQueryChange,
	onShowStalePackagesChange,
	onSortingChange,
	onStopSearchBatchLoading,
	onViewPackageSessions,
	packages,
	packagesView,
	searchQuery,
	showSearchLoadingControls,
	showSearchLoadingStop,
	showStalePackages,
	sorting
}: {
	canLoadMorePackages: boolean;
	isLoadingMorePackages: boolean;
	isLoadingPackages: boolean;
	isSearchBatchPaused: boolean;
	loadedSearchMatchCount: number;
	loadMorePackages: () => void;
	onContinueSearchBatchLoading: () => void;
	onPackagesViewChange: (view: AdminPackagesView) => void;
	onSearchQueryChange: (searchQuery: string) => void;
	onShowStalePackagesChange: (showStalePackages: boolean) => void;
	onSortingChange: (sorting: AdminPackageSort) => void;
	onStopSearchBatchLoading: () => void;
	onViewPackageSessions: (receiptNumber: string) => void;
	packages: AdminPackageRecord[];
	packagesView: AdminPackagesView;
	searchQuery: string;
	showSearchLoadingControls: boolean;
	showSearchLoadingStop: boolean;
	showStalePackages: boolean;
	sorting: AdminPackageSort;
}) {
	// Persist table preferences.
	useEffect(() => {
		storePackagesTableFilters({ sorting, packagesView, showStalePackages });
	}, [sorting, packagesView, showStalePackages]);

	const visiblePackages = useMemo(() => {
		return packages.map(mapPackageToAdminRow);
	}, [packages]);

	function updateCreatedSort() {
		onSortingChange({ isDescending: !sorting.isDescending });
		window.scrollTo({ top: 0 });
	}

	let packageRows: ReactNode = (
		<TableRow>
			<TableCell
				colSpan={9}
				className="h-24 text-center text-muted-foreground">
				No packages. L business.
			</TableCell>
		</TableRow>
	);

	if (isLoadingPackages) {
		packageRows = (
			<AdminTableLoadingRow
				colSpan={9}
				label="Loading packages"
			/>
		);
	}

	if (visiblePackages.length > 0) {
		packageRows = visiblePackages.map((packageRow) => (
			<PackageTableRow
				key={packageRow.id}
				onReceiptSearch={onSearchQueryChange}
				onViewPackageSessions={onViewPackageSessions}
				packageRow={packageRow}
			/>
		));
	}

	return (
		<section className="flex flex-col gap-4">
			<PackagesTableFilters
				isSearchBatchPaused={isSearchBatchPaused}
				loadedSearchMatchCount={loadedSearchMatchCount}
				packagesView={packagesView}
				searchQuery={searchQuery}
				showSearchLoadingControls={showSearchLoadingControls}
				showSearchLoadingStop={showSearchLoadingStop}
				showStalePackages={showStalePackages}
				onContinueSearchBatchLoading={onContinueSearchBatchLoading}
				onPackagesViewChange={onPackagesViewChange}
				onSearchQueryChange={onSearchQueryChange}
				onShowStalePackagesChange={onShowStalePackagesChange}
				onStopSearchBatchLoading={onStopSearchBatchLoading}
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
						{ key: "addons", colClassName: "w-36 md:w-28", header: "Addons" },
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
					{packageRows}
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
