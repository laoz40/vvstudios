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

type SessionsTableFiltersProps = {
	onSearchQueryChange: (searchQuery: string) => void;
	onShowArchivedChange: (checked: boolean) => void;
	onShowStaleBookingsChange: (checked: boolean) => void;
	onShowUpcomingOnlyChange: (checked: boolean) => void;
	searchQuery: string;
	showArchived: boolean;
	showStaleBookings: boolean;
	showUpcomingOnly: boolean;
};

export function SessionsTableFilters({
	onSearchQueryChange,
	onShowArchivedChange,
	onShowStaleBookingsChange,
	onShowUpcomingOnlyChange,
	searchQuery,
	showArchived,
	showStaleBookings,
	showUpcomingOnly
}: SessionsTableFiltersProps) {
	return (
		<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
				<Input
					placeholder="Search sessions..."
					value={searchQuery}
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
									checked={showUpcomingOnly}
									onCheckedChange={(checked) => onShowUpcomingOnlyChange(checked === true)}
									onSelect={(event) => event.preventDefault()}>
									Show due
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={showStaleBookings}
									onCheckedChange={(checked) => onShowStaleBookingsChange(checked === true)}
									onSelect={(event) => event.preventDefault()}>
									Show unconfirmed
								</DropdownMenuCheckboxItem>
								<DropdownMenuCheckboxItem
									checked={showArchived}
									onCheckedChange={(checked) => onShowArchivedChange(checked === true)}
									onSelect={(event) => event.preventDefault()}>
									Show archived
								</DropdownMenuCheckboxItem>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<div className="hidden flex-col gap-3 md:flex md:flex-row md:flex-wrap md:items-center">
				<div className="flex items-center gap-2">
					<Checkbox
						id="show-upcoming-only"
						checked={showUpcomingOnly}
						onCheckedChange={(checked) => onShowUpcomingOnlyChange(checked === true)}
					/>
					<Label
						htmlFor="show-upcoming-only"
						className="text-sm font-medium text-foreground">
						Show due
					</Label>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox
						id="show-stale-bookings"
						checked={showStaleBookings}
						onCheckedChange={(checked) => onShowStaleBookingsChange(checked === true)}
					/>
					<Label
						htmlFor="show-stale-bookings"
						className="text-sm font-medium text-foreground">
						Show unconfirmed
					</Label>
				</div>
				<div className="flex items-center gap-2">
					<Checkbox
						id="show-archived-bookings"
						checked={showArchived}
						onCheckedChange={(checked) => onShowArchivedChange(checked === true)}
					/>
					<Label
						htmlFor="show-archived-bookings"
						className="text-sm font-medium text-foreground">
						Show archived
					</Label>
				</div>
			</div>
		</div>
	);
}
