import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger
} from "#/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "#/components/ui/table";
import { cn } from "#/lib/utils";
import {
	filterAdminPackages,
	getAdminPackageStatusLabel,
	isAdminPackageOverdue,
	type AdminPackageFilters,
	type AdminPackageRow,
	type AdminPackageStatus
} from "#studio/features/admin/lib/admin-packages";
import { formatBookingTimestamp } from "#studio/lib/bookingdatetime";

const packageRows: AdminPackageRow[] = [];
type PackageCheckboxFilterKey = Exclude<keyof AdminPackageFilters, "searchQuery">;
type PackageSortDirection = "asc" | "desc";

const statusBadgeClassNames: Record<AdminPackageStatus, string> = {
	pending_payment: "bg-primary text-primary-foreground",
	invoice_email_failed: "bg-destructive text-primary-foreground",
	paid: "bg-green text-primary-foreground",
	schedule_email_failed: "bg-destructive text-primary-foreground"
};

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

function PackageActions({ packageRow }: { packageRow: AdminPackageRow }) {
	const isOverdue = isAdminPackageOverdue(packageRow);
	const canSendInvoice =
		packageRow.status === "pending_payment" || packageRow.status === "invoice_email_failed";
	const canSendSchedulingLink = packageRow.status === "schedule_email_failed";

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon-sm"
					className="touch-manipulation">
					<span className="sr-only">Open package actions</span>
					<MoreHorizontal aria-hidden />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-56 touch-manipulation">
				<DropdownMenuGroup>
					{canSendInvoice ? <DropdownMenuItem disabled>Send invoice</DropdownMenuItem> : null}
					{isOverdue ? <DropdownMenuItem disabled>Archive</DropdownMenuItem> : null}
					{canSendSchedulingLink ? (
						<DropdownMenuItem disabled>Send scheduling link</DropdownMenuItem>
					) : null}
					{!canSendInvoice && !isOverdue && !canSendSchedulingLink ? (
						<DropdownMenuItem disabled>No actions available</DropdownMenuItem>
					) : null}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function formatPackageDueDate(invoiceDueAt: number) {
	return new Intl.DateTimeFormat("en-AU", {
		day: "numeric",
		month: "short",
		year: "numeric"
	}).format(new Date(invoiceDueAt));
}

function renderCreatedHeader(
	sortDirection: PackageSortDirection,
	onSortDirectionChange: (sortDirection: PackageSortDirection) => void
) {
	const SortIcon =
		sortDirection === "asc" ? ArrowUp : sortDirection === "desc" ? ArrowDown : ArrowUpDown;

	return (
		<Button
			variant="ghost"
			className="px-0! text-foreground"
			onClick={() => onSortDirectionChange(sortDirection === "asc" ? "desc" : "asc")}>
			<span>Created</span>
			<SortIcon
				data-icon="inline-end"
				className="opacity-100"
			/>
		</Button>
	);
}

export function AdminPackagesDashboard() {
	// Package filters
	const [filters, setFilters] = useState<AdminPackageFilters>({
		hidePaid: true,
		hideOverdue: false,
		hideEmailIssues: false,
		searchQuery: ""
	});
	const [createdSortDirection, setCreatedSortDirection] = useState<PackageSortDirection>("desc");

	// Visible package rows after dashboard-level filters and created-date sorting.
	const visiblePackages = useMemo(() => {
		return [...filterAdminPackages(packageRows, filters)].sort((firstPackage, secondPackage) => {
			const createdComparison = firstPackage.createdAt - secondPackage.createdAt;

			if (createdComparison !== 0) {
				return createdSortDirection === "asc" ? createdComparison : -createdComparison;
			}

			return firstPackage.customerName.localeCompare(secondPackage.customerName);
		});
	}, [createdSortDirection, filters]);

	function updateFilter(key: PackageCheckboxFilterKey, checked: boolean) {
		setFilters((currentFilters) => ({ ...currentFilters, [key]: checked }));
	}

	function updateSearchQuery(searchQuery: string) {
		setFilters((currentFilters) => ({ ...currentFilters, searchQuery }));
	}

	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<Input
					placeholder="Search packages..."
					value={filters.searchQuery}
					onChange={(event) => updateSearchQuery(event.target.value)}
					className="w-full md:w-sm"
				/>
				<div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-end">
					<PackageFilterCheckbox
						id="hide-paid-packages"
						label="Hide paid"
						checked={filters.hidePaid}
						onCheckedChange={(checked) => updateFilter("hidePaid", checked)}
					/>
					<PackageFilterCheckbox
						id="hide-overdue-packages"
						label="Hide overdue"
						checked={filters.hideOverdue}
						onCheckedChange={(checked) => updateFilter("hideOverdue", checked)}
					/>
					<PackageFilterCheckbox
						id="hide-email-issue-packages"
						label="Hide errors"
						checked={filters.hideEmailIssues}
						onCheckedChange={(checked) => updateFilter("hideEmailIssues", checked)}
					/>
				</div>
			</div>

			<div className="overflow-x-auto border-y">
				<Table className="min-w-7xl table-fixed">
					<TableHeader>
						<TableRow>
							<TableHead className="w-36">Customer</TableHead>
							<TableHead className="w-52">Status</TableHead>
							<TableHead className="w-40">Package</TableHead>
							<TableHead className="w-56 md:w-36">Contact</TableHead>
							<TableHead className="w-56">Notes</TableHead>
							<TableHead className="w-40">Due</TableHead>
							<TableHead className="w-32">Total</TableHead>
							<TableHead className="w-36 md:w-20">
								{renderCreatedHeader(createdSortDirection, setCreatedSortDirection)}
							</TableHead>
							<TableHead className="w-64 text-right" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{visiblePackages.length > 0 ? (
							visiblePackages.map((packageRow) => {
								const isOverdue = isAdminPackageOverdue(packageRow);

								return (
									<TableRow key={packageRow.id}>
										<TableCell>
											<div className="flex flex-col gap-1 whitespace-normal">
												<p className="font-medium text-foreground">{packageRow.customerName}</p>
											</div>
										</TableCell>
										<TableCell>
											<Badge className={cn(statusBadgeClassNames[packageRow.status])}>
												{getAdminPackageStatusLabel(packageRow.status)}
											</Badge>
										</TableCell>
										<TableCell>
											<div className="flex flex-col gap-1">
												<p className="font-medium text-foreground">
													{packageRow.packageSize} sessions
												</p>
												<p className="text-sm text-muted-foreground">
													{packageRow.bookedSessions} / {packageRow.packageSize} booked
												</p>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex flex-col gap-1 whitespace-normal">
												<p className="break-all font-medium">{packageRow.customerEmail}</p>
												<p className="text-sm">{packageRow.customerPhone}</p>
											</div>
										</TableCell>
										<TableCell>
											<p className="whitespace-normal text-sm text-muted-foreground">
												{packageRow.notes?.trim() || "No notes"}
											</p>
										</TableCell>
										<TableCell>
											<div className="flex flex-col gap-1">
												<span>{formatPackageDueDate(packageRow.invoiceDueAt)}</span>
												{isOverdue ? <Badge variant="destructive">Overdue</Badge> : null}
											</div>
										</TableCell>
										<TableCell>{packageRow.totalDueLabel}</TableCell>
										<TableCell>
											<p className="min-w-44 font-medium whitespace-normal">
												{formatBookingTimestamp(packageRow.createdAt)}
											</p>
										</TableCell>
										<TableCell>
											<PackageActions packageRow={packageRow} />
										</TableCell>
									</TableRow>
								);
							})
						) : (
							<TableRow>
								<TableCell
									colSpan={9}
									className="h-24 text-center text-muted-foreground">
									No package requests. L business.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</section>
	);
}
