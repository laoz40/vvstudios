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
									checked={filters.showPaid}
									onCheckedChange={(checked) => onFilterChange("showPaid", checked === true)}
									onSelect={(event) => event.preventDefault()}>
									Paid only
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={filters.showOverdue}
									onCheckedChange={(checked) => onFilterChange("showOverdue", checked === true)}
									onSelect={(event) => event.preventDefault()}>
									Overdue only
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={filters.showUpcoming}
									onCheckedChange={(checked) => onFilterChange("showUpcoming", checked === true)}
									onSelect={(event) => event.preventDefault()}>
									Upcoming only
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={filters.showArchived}
									onCheckedChange={(checked) => onFilterChange("showArchived", checked === true)}
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
					checked={filters.showPaid}
					id="show-paid-packages"
					label="Paid only"
					onCheckedChange={(checked) => onFilterChange("showPaid", checked)}
				/>
				<PackageFilterCheckbox
					checked={filters.showOverdue}
					id="show-overdue-packages"
					label="Overdue only"
					onCheckedChange={(checked) => onFilterChange("showOverdue", checked)}
				/>
				<PackageFilterCheckbox
					checked={filters.showUpcoming}
					id="show-upcoming-packages"
					label="Upcoming only"
					onCheckedChange={(checked) => onFilterChange("showUpcoming", checked)}
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
