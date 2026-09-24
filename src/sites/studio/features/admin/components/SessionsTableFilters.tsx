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
import { SessionsListViewTabs } from "#studio/features/admin/components/SessionsListViewTabs";
import type { AdminSessionsView } from "#studio/features/admin/lib/admin-sessions";

type SessionsTableFiltersProps = {
	onSearchQueryChange: (searchQuery: string) => void;
	onSessionsViewChange: (view: AdminSessionsView) => void;
	onShowStaleSessionsChange: (checked: boolean) => void;
	searchQuery: string;
	sessionsView: AdminSessionsView;
	showStaleSessions: boolean;
};

export function SessionsTableFilters({
	onSearchQueryChange,
	onSessionsViewChange,
	onShowStaleSessionsChange,
	searchQuery,
	sessionsView,
	showStaleSessions
}: SessionsTableFiltersProps) {
	return (
		<div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
				<Input
					placeholder="Search sessions..."
					value={searchQuery}
					onChange={(event) => onSearchQueryChange(event.target.value)}
					className="w-full md:w-sm"
				/>
				<SessionsListViewTabs
					view={sessionsView}
					onViewChange={onSessionsViewChange}
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
								checked={showStaleSessions}
								onCheckedChange={(checked) => onShowStaleSessionsChange(checked)}
								onSelect={(event) => event.preventDefault()}>
								Show unconfirmed
							</DropdownMenuCheckboxItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
				<div className="hidden items-center gap-1.5 md:flex">
					<Checkbox
						id="show-stale-sessions"
						checked={showStaleSessions}
						onCheckedChange={(checked) => onShowStaleSessionsChange(checked === true)}
						className="size-4 rounded-sm"
					/>
					<Label
						htmlFor="show-stale-sessions"
						className="text-sm font-normal text-muted-foreground">
						Show unconfirmed
					</Label>
				</div>
			</div>
		</div>
	);
}
