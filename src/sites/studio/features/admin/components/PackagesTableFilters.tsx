import { ListFilter } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuTrigger
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { AdminInboxAllViewTabs } from "#studio/features/admin/components/AdminInboxAllViewTabs";
import { AdminSearchBatchLoadingControls } from "#studio/features/admin/components/AdminSearchRefineBanner";
import type { AdminPackagesView } from "#studio/features/admin/lib/admin-packages";

type PackagesTableFiltersProps = {
	isSearchBatchPaused: boolean;
	loadedSearchMatchCount: number;
	onContinueSearchBatchLoading: () => void;
	onPackagesViewChange: (view: AdminPackagesView) => void;
	onSearchQueryChange: (searchQuery: string) => void;
	onShowStalePackagesChange: (checked: boolean) => void;
	onStopSearchBatchLoading: () => void;
	packagesView: AdminPackagesView;
	searchQuery: string;
	showSearchLoadingControls: boolean;
	showSearchLoadingStop: boolean;
	showStalePackages: boolean;
};

export function PackagesTableFilters({
	isSearchBatchPaused,
	loadedSearchMatchCount,
	onContinueSearchBatchLoading,
	onPackagesViewChange,
	onSearchQueryChange,
	onShowStalePackagesChange,
	onStopSearchBatchLoading,
	packagesView,
	searchQuery,
	showSearchLoadingControls,
	showSearchLoadingStop,
	showStalePackages
}: PackagesTableFiltersProps) {
	return (
		<div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
				<AdminInboxAllViewTabs
					allTabLabel="All packages"
					view={packagesView}
					onViewChange={onPackagesViewChange}
				/>
				<div className="flex items-center gap-2">
					<Input
						placeholder="Search packages..."
						value={searchQuery}
						onChange={(event) => onSearchQueryChange(event.target.value)}
						className="w-full md:w-sm"
					/>
					{showSearchLoadingControls ? (
						<div className="hidden shrink-0 md:block">
							<AdminSearchBatchLoadingControls
								isPaused={isSearchBatchPaused}
								loadedCount={loadedSearchMatchCount}
								showStop={showSearchLoadingStop}
								onContinue={onContinueSearchBatchLoading}
								onStop={onStopSearchBatchLoading}
							/>
						</div>
					) : null}
				</div>
			</div>
			<div
				className={
					showSearchLoadingControls
						? "flex w-full items-center justify-between gap-3 md:ml-auto md:w-auto md:justify-end"
						: "flex w-full items-center justify-end gap-3 md:ml-auto md:w-auto"
				}>
				{showSearchLoadingControls ? (
					<div className="shrink-0 md:hidden">
						<AdminSearchBatchLoadingControls
							isPaused={isSearchBatchPaused}
							loadedCount={loadedSearchMatchCount}
							showStop={showSearchLoadingStop}
							onContinue={onContinueSearchBatchLoading}
							onStop={onStopSearchBatchLoading}
						/>
					</div>
				) : null}
				<div className="flex items-center gap-3">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="md:hidden">
								<ListFilter aria-hidden />
								Filters
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuGroup>
								<DropdownMenuCheckboxItem
									checked={showStalePackages}
									onCheckedChange={(checked) => onShowStalePackagesChange(checked)}
									onSelect={(event) => event.preventDefault()}>
									Show unconfirmed
								</DropdownMenuCheckboxItem>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
					<div className="hidden items-center gap-1.5 md:flex">
						<Checkbox
							id="show-stale-packages"
							checked={showStalePackages}
							onCheckedChange={(checked) => onShowStalePackagesChange(checked === true)}
							className="size-4 rounded-sm"
						/>
						<Label
							htmlFor="show-stale-packages"
							className="text-sm font-normal text-muted-foreground">
							Show unconfirmed
						</Label>
					</div>
				</div>
			</div>
		</div>
	);
}
