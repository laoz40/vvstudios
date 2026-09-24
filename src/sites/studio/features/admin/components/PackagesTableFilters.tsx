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
import type { AdminPackagesView } from "#studio/features/admin/lib/admin-packages";

type PackagesTableFiltersProps = {
	onPackagesViewChange: (view: AdminPackagesView) => void;
	onSearchQueryChange: (searchQuery: string) => void;
	onShowStalePackagesChange: (checked: boolean) => void;
	packagesView: AdminPackagesView;
	searchQuery: string;
	showStalePackages: boolean;
};

export function PackagesTableFilters({
	onPackagesViewChange,
	onSearchQueryChange,
	onShowStalePackagesChange,
	packagesView,
	searchQuery,
	showStalePackages
}: PackagesTableFiltersProps) {
	return (
		<div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
				<Input
					placeholder="Search packages..."
					value={searchQuery}
					onChange={(event) => onSearchQueryChange(event.target.value)}
					className="w-full md:w-sm"
				/>
				<AdminInboxAllViewTabs
					allTabLabel="All packages"
					view={packagesView}
					onViewChange={onPackagesViewChange}
				/>
			</div>
			<div className="flex items-center justify-end gap-3 md:ml-auto">
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
	);
}
