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
import type { AdminPackageFilters } from "#studio/features/admin/lib/admin-packages";

type PackageCheckboxFilterKey = Exclude<keyof AdminPackageFilters, "searchQuery">;

type PackagesTableFiltersProps = {
	filters: AdminPackageFilters;
	onFilterChange: (key: PackageCheckboxFilterKey, checked: boolean) => void;
	onSearchQueryChange: (searchQuery: string) => void;
};

export function PackagesTableFilters({
	filters,
	onFilterChange,
	onSearchQueryChange
}: PackagesTableFiltersProps) {
	return (
		<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
				<Input
					placeholder="Search packages..."
					value={filters.searchQuery}
					onChange={(event) => onSearchQueryChange(event.target.value)}
					className="w-full md:w-sm"
				/>
				<div className="flex items-center justify-end gap-3 md:contents">
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
									checked={filters.showDueOnly}
									onCheckedChange={(checked) => onFilterChange("showDueOnly", checked)}
									onSelect={(event) => event.preventDefault()}>
									Show due
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={filters.showStalePackages}
									onCheckedChange={(checked) => onFilterChange("showStalePackages", checked)}
									onSelect={(event) => event.preventDefault()}>
									Show unconfirmed
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={filters.showArchived}
									onCheckedChange={(checked) => onFilterChange("showArchived", checked)}
									onSelect={(event) => event.preventDefault()}>
									Show archived
								</DropdownMenuCheckboxItem>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<div className="hidden flex-col gap-3 md:flex md:flex-row md:flex-wrap md:items-center md:justify-end">
				<PackageFilterCheckbox
					checked={filters.showDueOnly}
					id="show-due-packages"
					label="Show due"
					onCheckedChange={(checked) => onFilterChange("showDueOnly", checked)}
				/>
				<PackageFilterCheckbox
					checked={filters.showStalePackages}
					id="show-stale-packages"
					label="Show unconfirmed"
					onCheckedChange={(checked) => onFilterChange("showStalePackages", checked)}
				/>
				<PackageFilterCheckbox
					checked={filters.showArchived}
					id="show-archived-packages"
					label="Show archived"
					onCheckedChange={(checked) => onFilterChange("showArchived", checked)}
				/>
			</div>
		</div>
	);
}

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
