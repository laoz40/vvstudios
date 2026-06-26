import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import {
	type ColumnFiltersState,
	type SortingState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable
} from "@tanstack/react-table";
import { useMutation } from "convex/react";
import { ListFilter, Menu } from "lucide-react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { CleanupOldPendingAndExpiredBookingsResult } from "#convex/bookings";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import TrashIcon from "#/components/ui/trash-icon";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuTrigger
} from "#/components/ui/dropdown-menu";
import { Label } from "#/components/ui/label";
import { Input } from "#/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "#/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger
} from "#/components/ui/sheet";
import { cn } from "#/lib/utils";
import { tryCatch } from "#/lib/result";
import { AdminAvailabilitySettings } from "#studio/features/admin/components/AdminAvailabilitySettings";
import {
	buildAdminDashboardColumns,
	getColumnClassName
} from "#studio/features/admin/components/AdminDashboardColumns";
import {
	readStoredAdminDashboardSorting,
	readStoredShowStaleBookings,
	readStoredShowUpcomingOnly,
	storeAdminDashboardSorting,
	storeShowStaleBookings,
	storeShowUpcomingOnly
} from "#studio/features/admin/lib/admin-dashboard-preferences";
import { hasUnpaidRemainingBalance } from "#studio/features/admin/lib/remaining-balance";
import { hasUnsentDeliverables } from "#studio/features/admin/lib/booking-edit-status";
import { isStaleCleanupBooking } from "#studio/features/admin/lib/admin-bookings";
import { getStartOfWeekTimestamp, isUpcomingBooking } from "#studio/lib/bookingdatetime";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";

export type AdminDashboardProps = {
	bookings: BookingRecord[];
	canLoadMoreBookings: boolean;
	email: string | null;
	isLoadingMoreBookings: boolean;
	loadMoreBookings: () => void;
	signOutControl: ReactNode;
};

function AdminDashboardMenu({
	email,
	signOutControl
}: Pick<AdminDashboardProps, "email" | "signOutControl">) {
	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="md:hidden"
					aria-label="Open admin menu">
					<Menu aria-hidden />
				</Button>
			</SheetTrigger>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>Admin menu</SheetTitle>
					<SheetDescription>Signed in as {email ?? "Unknown user"}.</SheetDescription>
				</SheetHeader>
				<div className="flex flex-col items-start gap-2 px-4">
					<AdminAvailabilitySettings />
					{signOutControl}
				</div>
			</SheetContent>
		</Sheet>
	);
}

function AdminStatusMetric({
	label,
	value,
	variant,
	className
}: {
	label: string;
	value: string;
	variant?: ComponentProps<typeof Badge>["variant"];
	className?: string;
}) {
	return (
		<div className="flex w-fit items-center justify-between gap-2 md:w-28 md:gap-0">
			<Badge
				variant={variant ?? "outline"}
				className={cn("text-sm", className)}>
				{label}
			</Badge>
			<p className="text-lg font-medium text-foreground">{value}</p>
		</div>
	);
}

export function AdminDashboard({
	bookings,
	canLoadMoreBookings,
	email,
	isLoadingMoreBookings,
	loadMoreBookings,
	signOutControl
}: AdminDashboardProps) {
	// Convex mutations
	const cleanupOldBookings = useMutation(api.bookings.cleanupOldPendingAndExpiredBookings);

	// Table setup and persisted filters
	const columns = useMemo(() => buildAdminDashboardColumns(), []);
	const [sorting, setSorting] = useState<SortingState>(() => readStoredAdminDashboardSorting());
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [showUpcomingOnly, setShowUpcomingOnly] = useState(() => readStoredShowUpcomingOnly());
	const [showStaleBookings, setShowStaleBookings] = useState(() => readStoredShowStaleBookings());

	// Cleanup dialog state
	const [isCleanupDialogOpen, setIsCleanupDialogOpen] = useState(false);
	const [isCleaningUp, setIsCleaningUp] = useState(false);

	// Cleanup candidates
	const staleCleanupBookings = useMemo(
		() => bookings.filter((booking) => isStaleCleanupBooking(booking)),
		[bookings]
	);

	// Persist table sorting changes.
	useEffect(() => {
		storeAdminDashboardSorting(sorting);
	}, [sorting]);

	// Persist the upcoming-only filter.
	useEffect(() => {
		storeShowUpcomingOnly(showUpcomingOnly);
	}, [showUpcomingOnly]);

	// Persist the stale-bookings filter.
	useEffect(() => {
		storeShowStaleBookings(showStaleBookings);
	}, [showStaleBookings]);

	// Visible booking rows after dashboard-level filters.
	const filteredBookings = useMemo(() => {
		return bookings.filter((booking) => {
			if (
				showUpcomingOnly &&
				!isUpcomingBooking(booking.date, booking.time) &&
				!hasUnsentDeliverables(booking) &&
				!hasUnpaidRemainingBalance(booking)
			) {
				return false;
			}

			if (!showStaleBookings && isStaleCleanupBooking(booking)) {
				return false;
			}

			return true;
		});
	}, [bookings, showStaleBookings, showUpcomingOnly]);

	// Cleanup actions
	async function handleCleanupOldBookings() {
		setIsCleaningUp(true);

		const [error, result] = await tryCatch<CleanupOldPendingAndExpiredBookingsResult>(
			cleanupOldBookings({})
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to clean up bookings.");
					break;

				case "BOOKING_CLEANUP_FAILED":
					toast.error("Unable to clean up old bookings.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while cleaning up old bookings.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsCleaningUp(false);
			return;
		}

		setIsCleanupDialogOpen(false);
		toast.success(
			result.deletedCount === 1
				? "Deleted 1 unconfirmed booking."
				: `Deleted ${result.deletedCount} unconfirmed bookings.`
		);
		setIsCleaningUp(false);
	}

	// React table instance
	const table = useReactTable({
		data: filteredBookings,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		initialState: { pagination: { pageSize: 12 } },
		state: { sorting, columnFilters }
	});

	// Dashboard summary values
	const metrics = useMemo(() => {
		const startOfWeekTimestamp = getStartOfWeekTimestamp();
		const counts = filteredBookings.reduce(
			(accumulator, booking) => {
				accumulator.total += 1;
				accumulator[booking.status] += 1;
				if (
					(booking.status === "confirmed" || booking.status === "email_failed") &&
					booking.pendingPaymentCreatedAt >= startOfWeekTimestamp
				) {
					accumulator.thisWeek += 1;
				}
				return accumulator;
			},
			{
				total: 0,
				thisWeek: 0,
				abandoned: 0,
				confirmed: 0,
				email_failed: 0,
				expired: 0,
				failed: 0,
				pending_payment: 0
			}
		);

		return counts;
	}, [filteredBookings]);

	const staleCounts = useMemo(
		() =>
			staleCleanupBookings.reduce(
				(accumulator, booking) => {
					accumulator[booking.status] += 1;
					return accumulator;
				},
				{ abandoned: 0, confirmed: 0, expired: 0, email_failed: 0, failed: 0, pending_payment: 0 }
			),
		[staleCleanupBookings]
	);

	return (
		<main
			className={cn(
				"relative flex min-h-screen flex-col gap-5 md:gap-6",
				"bg-card",
				"p-3 pb-8 md:p-4 lg:px-6"
			)}>
			<div className="absolute top-3 right-3 md:hidden">
				<AdminDashboardMenu
					email={email}
					signOutControl={signOutControl}
				/>
			</div>
			<section className="flex flex-col gap-4 pr-14 md:gap-5 md:pr-0">
				<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<div
						className={cn(
							"flex flex-col gap-3",
							"sm:flex-row sm:items-start sm:justify-between sm:gap-4",
							"xl:items-center xl:gap-10"
						)}>
						<h1
							title="It would look better if the text were bigger. What do you think, Joseph?"
							className={cn(
								"cursor-help",
								"font-brand text-4xl md:text-[10rem] leading-none font-medium uppercase",
								"text-foreground"
							)}>
							Bookings Dashboard
						</h1>
						<div className="flex flex-wrap items-start gap-x-4 gap-y-2 sm:flex-col sm:gap-2">
							<AdminStatusMetric
								label="Confirmed"
								value={String(metrics.confirmed)}
								variant="default"
								className="bg-green text-primary-foreground"
							/>
							<AdminStatusMetric
								label="Pending"
								value={String(metrics.pending_payment)}
								variant="secondary"
								className="bg-primary text-primary-foreground"
							/>
							<AdminStatusMetric
								label="Failed"
								value={String(metrics.failed)}
								variant="destructive"
								className="bg-destructive text-primary-foreground"
							/>
						</div>
					</div>
					<div className="hidden flex-col items-start gap-3 md:flex md:items-end">
						<p className="text-sm text-muted-foreground">Signed in as {email ?? "Unknown user"}.</p>
						<div className="flex flex-wrap items-center gap-2">
							<AdminAvailabilitySettings />
							{signOutControl}
						</div>
					</div>
				</div>
			</section>

			<section className="flex flex-col gap-4">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
						<Input
							placeholder="Search bookings..."
							value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
							onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
							className="w-full md:w-sm"
						/>
						<div className="flex items-center justify-between gap-3 md:contents">
							<p className="text-sm text-muted-foreground">
								{metrics.thisWeek} {metrics.thisWeek === 1 ? "booking" : "bookings"} made this week
							</p>
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
											checked={showStaleBookings}
											onCheckedChange={(checked) => setShowStaleBookings(checked === true)}
											onSelect={(event) => event.preventDefault()}>
											Show unconfirmed bookings
										</DropdownMenuCheckboxItem>
										<DropdownMenuCheckboxItem
											checked={showUpcomingOnly}
											onCheckedChange={(checked) => setShowUpcomingOnly(checked === true)}
											onSelect={(event) => event.preventDefault()}>
											Show only due sessions
										</DropdownMenuCheckboxItem>
									</DropdownMenuGroup>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>
					<div className="hidden flex-col gap-3 md:flex md:flex-row md:flex-wrap md:items-center">
						<div className="flex items-center gap-2">
							<Checkbox
								id="show-stale-bookings"
								checked={showStaleBookings}
								onCheckedChange={(checked) => setShowStaleBookings(checked === true)}
							/>
							<Label
								htmlFor="show-stale-bookings"
								className="text-sm font-medium text-foreground">
								Show unconfirmed bookings
							</Label>
						</div>
						<div className="flex items-center gap-2">
							<Checkbox
								id="show-upcoming-only"
								checked={showUpcomingOnly}
								onCheckedChange={(checked) => setShowUpcomingOnly(checked === true)}
							/>
							<Label
								htmlFor="show-upcoming-only"
								className="text-sm font-medium text-foreground">
								Show only due sessions
							</Label>
						</div>
					</div>
				</div>

				<div className="overflow-x-auto border-y">
					<Table className="min-w-6xl table-fixed">
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => (
										<TableHead
											key={header.id}
											className={getColumnClassName(header.column.id)}>
											{header.isPlaceholder
												? null
												: flexRender(header.column.columnDef.header, header.getContext())}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table.getRowModel().rows.length > 0 ? (
								table.getRowModel().rows.map((row) => {
									const isPastBooking = !isUpcomingBooking(row.original.date, row.original.time);

									return (
										<TableRow
											key={row.id}
											className={cn(isPastBooking && "text-muted-foreground")}>
											{row.getVisibleCells().map((cell) => (
												<TableCell
													key={cell.id}
													className={cn(
														getColumnClassName(cell.column.id),
														isPastBooking && cell.column.id !== "editStatus" && "opacity-70"
													)}>
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</TableCell>
											))}
										</TableRow>
									);
								})
							) : (
								<TableRow>
									<TableCell
										colSpan={table.getVisibleLeafColumns().length}
										className="h-24 text-center text-muted-foreground">
										No bookings yet. L business.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>

				<div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-3">
					<div className="flex flex-wrap items-center gap-3 md:gap-6">
						<div
							className={cn(
								"flex w-full items-center justify-between gap-3",
								"md:w-auto md:justify-start md:gap-6"
							)}>
							<p className="text-sm text-muted-foreground">
								Showing {table.getFilteredRowModel().rows.length}{" "}
								{table.getFilteredRowModel().rows.length === 1 ? "booking" : "bookings"} ·{" "}
								{bookings.length} {bookings.length === 1 ? "booking" : "bookings"} loaded
							</p>
							<AnimatedIconButton
								variant="ghost"
								size="sm"
								className="text-sm! hover:text-destructive"
								disabled={isCleaningUp || staleCleanupBookings.length === 0}
								aria-label="Clean up unconfirmed bookings"
								onClick={() => setIsCleanupDialogOpen(true)}
								iconPosition="before"
								renderIcon={(iconRef) => (
									<TrashIcon
										ref={iconRef}
										aria-hidden
									/>
								)}>
								<button type="button">
									<span className="hidden md:inline">Clean up unconfirmed bookings</span>
								</button>
							</AnimatedIconButton>
						</div>
						{canLoadMoreBookings || isLoadingMoreBookings ? (
							<Button
								variant="outline"
								size="sm"
								onClick={loadMoreBookings}
								disabled={isLoadingMoreBookings}>
								{isLoadingMoreBookings ? "Loading..." : "Load more"}
							</Button>
						) : null}
					</div>
					<div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
						<p className="text-sm text-muted-foreground">
							Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.previousPage()}
							disabled={!table.getCanPreviousPage()}>
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() => table.nextPage()}
							disabled={!table.getCanNextPage()}>
							Next
						</Button>
					</div>
				</div>
			</section>

			<Dialog
				open={isCleanupDialogOpen}
				onOpenChange={setIsCleanupDialogOpen}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Clean up unconfirmed bookings?</DialogTitle>
						<DialogDescription>
							This will permanently delete unconfirmed booking records from the database.
						</DialogDescription>
					</DialogHeader>

					<div className="rounded-lg border bg-muted/40 p-3 text-sm">
						<p className="font-medium">{staleCleanupBookings.length} bookings will be deleted</p>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
							<li>{staleCounts.expired} expired bookings</li>
							<li>{staleCounts.abandoned} abandoned bookings</li>
							<li>{staleCounts.pending_payment} pending bookings older than 24 hours</li>
						</ul>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsCleanupDialogOpen(false)}
							disabled={isCleaningUp}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleCleanupOldBookings}
							disabled={isCleaningUp || staleCleanupBookings.length === 0}>
							{isCleaningUp ? "Deleting..." : "Delete unconfirmed bookings"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
}
