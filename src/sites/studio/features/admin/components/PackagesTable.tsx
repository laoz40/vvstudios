import { useEffect, useMemo, useState } from "react";
import { TableCell, TableRow } from "#/components/ui/table";
import { FixedDataTable } from "#studio/components/FixedDataTable";
import {
	SortHeaderButton,
	AdminTableLoadingRow
} from "#studio/features/admin/components/AdminDashboardTableUtils";
import { PackageTableRow } from "#studio/features/admin/components/PackageTableRow";
import { PackagesTableFilters } from "#studio/features/admin/components/PackagesTableFilters";
import {
	filterAdminPackages,
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
	loadMorePackages,
	onPackagesViewChange,
	onShowStalePackagesChange,
	onSortingChange,
	onViewPackageSessions,
	packages,
	packagesView,
	showStalePackages,
	sorting
}: {
	canLoadMorePackages: boolean;
	isLoadingMorePackages: boolean;
	isLoadingPackages: boolean;
	loadMorePackages: () => void;
	onPackagesViewChange: (view: AdminPackagesView) => void;
	onShowStalePackagesChange: (showStalePackages: boolean) => void;
	onSortingChange: (sorting: AdminPackageSort) => void;
	onViewPackageSessions: (invoiceNumber: string) => void;
	packages: AdminPackageRecord[];
	packagesView: AdminPackagesView;
	showStalePackages: boolean;
	sorting: AdminPackageSort;
}) {
	const [searchQuery, setSearchQuery] = useState("");

	// Persist table preferences.
	useEffect(() => {
		storePackagesTableFilters({ sorting, packagesView, showStalePackages });
	}, [sorting, packagesView, showStalePackages]);

	// Visible package rows after client search on loaded pages.
	const visiblePackages = useMemo(() => {
		return filterAdminPackages(packages.map(mapPackageToAdminRow), { searchQuery });
	}, [packages, searchQuery]);

	// Prefetch another page when client-side search hides every loaded package.
	useEffect(() => {
		if (
			visiblePackages.length === 0 &&
			canLoadMorePackages &&
			!isLoadingPackages &&
			!isLoadingMorePackages
		) {
			loadMorePackages();
		}
	}, [
		visiblePackages.length,
		canLoadMorePackages,
		isLoadingPackages,
		isLoadingMorePackages,
		loadMorePackages
	]);

	function updateCreatedSort() {
		onSortingChange({ isDescending: !sorting.isDescending });
		window.scrollTo({ top: 0 });
	}

	return (
		<section className="flex flex-col gap-4">
			<PackagesTableFilters
				packagesView={packagesView}
				searchQuery={searchQuery}
				showStalePackages={showStalePackages}
				onPackagesViewChange={onPackagesViewChange}
				onSearchQueryChange={setSearchQuery}
				onShowStalePackagesChange={onShowStalePackagesChange}
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
					{visiblePackages.length > 0 ? (
						visiblePackages.map((packageRow) => (
							<PackageTableRow
								key={packageRow.id}
								onViewPackageSessions={onViewPackageSessions}
								packageRow={packageRow}
							/>
						))
					) : isLoadingPackages ? (
						<AdminTableLoadingRow
							colSpan={9}
							label="Loading packages"
						/>
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
