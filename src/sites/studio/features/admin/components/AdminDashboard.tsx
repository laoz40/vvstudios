import * as React from "react";
import {
	type Column,
	type ColumnDef,
	type ColumnFiltersState,
	type SortingState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { useMutation } from "convex/react";
import { ArrowDown, ArrowUp, ArrowUpDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import { Badge } from "#/components/ui/badge";
import { Checkbox } from "#/components/ui/checkbox";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Label } from "#/components/ui/label";
import { BookingActions } from "#studio/features/admin/components/BookingActions";
import {
	formatBookingDateMedium,
	formatBookingTimestamp,
	formatBookingTimeLabel,
	getBookingStartTimestamp,
	getStartOfWeekTimestamp,
	isUpcomingBooking,
} from "#studio/lib/bookingdatetime";
import { cn } from "#/lib/utils";

type BookingRecord = Doc<"bookings">;
type AdminBookingRecord = BookingRecord;

const STRIPE_CHECKOUT_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

export type AdminDashboardProps = {
	bookings: BookingRecord[];
	canLoadMoreBookings: boolean;
	email: string | null;
	isLoadingMoreBookings: boolean;
	loadMoreBookings: () => void;
	signOutControl: React.ReactNode;
};

const statusLabelMap: Record<AdminBookingRecord["status"], string> = {
	abandoned: "Abandoned",
	confirmed: "Confirmed",
	expired: "Expired",
	failed: "Needs follow up",
	pending_payment: "Pending payment",
};

const statusBadgeVariantMap: Record<
	AdminBookingRecord["status"],
	React.ComponentProps<typeof Badge>["variant"]
> = {
	abandoned: "outline",
	confirmed: "default",
	expired: "outline",
	failed: "destructive",
	pending_payment: "secondary",
};

const statusBadgeClassNameMap: Record<AdminBookingRecord["status"], string | undefined> = {
	abandoned: "bg-muted text-muted-foreground hover:bg-muted",
	confirmed: "bg-green-600 text-white hover:bg-green-600/90",
	expired: "bg-orange-600 text-white hover:bg-orange-600/90",
	failed: undefined,
	pending_payment: "bg-blue-600 text-white hover:bg-blue-600/90",
};

function getColumnClassName(columnId: string) {
	switch (columnId) {
		case "name":
			return "w-48";
		case "status":
			return "w-20";
		case "session":
			return "w-24";
		case "service":
			return "w-64";
		case "contact":
			return "w-48";
		case "notes":
			return "w-56";
		case "createdAt":
			return "w-24";
		case "actions":
			return "w-10";
		default:
			return undefined;
	}
}

function isStaleCleanupBooking(booking: BookingRecord, now = Date.now()) {
	if (booking.status === "expired" || booking.status === "abandoned") {
		return true;
	}

	return (
		booking.status === "pending_payment" &&
		booking.pendingPaymentCreatedAt < now - STRIPE_CHECKOUT_SESSION_EXPIRY_MS
	);
}

function customerFilter(row: { original: AdminBookingRecord }, value: unknown) {
	const query = String(value ?? "")
		.trim()
		.toLowerCase();

	if (!query) {
		return true;
	}

	return [
		row.original.name,
		row.original.email,
		row.original.accountName,
		row.original.phone,
		row.original.service,
		row.original.date,
	]
		.filter(Boolean)
		.some((field) => field.toLowerCase().includes(query));
}

function renderSortableHeader(label: string, column: Column<AdminBookingRecord>) {
	const sortDirection = column.getIsSorted();
	const SortIcon =
		sortDirection === "asc" ? ArrowUp : sortDirection === "desc" ? ArrowDown : ArrowUpDown;

	return (
		<Button
			variant="ghost"
			className={cn(
				"px-0!",
				sortDirection ? "text-foreground" : "text-muted-foreground hover:text-foreground",
			)}
			onClick={() => column.toggleSorting(sortDirection === "asc")}>
			<span>{label}</span>
			<SortIcon
				data-icon="inline-end"
				className={cn(sortDirection ? "opacity-100" : "opacity-60")}
			/>
		</Button>
	);
}

function buildColumns(): ColumnDef<AdminBookingRecord>[] {
	return [
		{
			accessorKey: "name",
			header: ({ column }) => renderSortableHeader("Customer", column),
			cell: ({ row }) => (
				<div className="flex flex-col gap-1 whitespace-normal">
					<p className="font-medium">{row.original.name}</p>
					<p className="text-sm text-muted-foreground">
						{row.original.accountName}
						{row.original.abn ? ` · ABN ${row.original.abn}` : ""}
					</p>
				</div>
			),
			filterFn: (row, _columnId, value) => customerFilter(row, value),
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => (
				<Badge
					variant={statusBadgeVariantMap[row.original.status]}
					className={statusBadgeClassNameMap[row.original.status]}>
					{statusLabelMap[row.original.status]}
				</Badge>
			),
		},
		{
			id: "session",
			accessorFn: (row) => getBookingStartTimestamp(row.date, row.time),
			header: ({ column }) => renderSortableHeader("Session", column),
			cell: ({ row }) => (
				<div className="flex flex-col gap-1 whitespace-normal">
					<p className="font-medium">{formatBookingDateMedium(row.original.date)}</p>
					<p className="text-sm text-muted-foreground">
						{formatBookingTimeLabel(row.original.time)}
						{row.original.duration ? ` · ${row.original.duration}` : ""}
					</p>
				</div>
			),
		},
		{
			accessorKey: "service",
			header: "Service",
			cell: ({ row }) => (
				<div className="flex min-w-48 flex-col gap-2 whitespace-normal">
					<p className="font-medium">{row.original.service}</p>
					{row.original.addons.length > 0 ? (
						<div className="flex flex-wrap gap-1">
							{row.original.addons.map((addon) => (
								<Badge
									key={addon}
									variant="outline">
									{addon}
								</Badge>
							))}
						</div>
					) : (
						<p className="text-sm text-muted-foreground">No add-ons</p>
					)}
				</div>
			),
		},
		{
			id: "contact",
			header: "Contact",
			accessorFn: (row) => `${row.email} ${row.phone ?? ""}`,
			cell: ({ row }) => (
				<div className="flex flex-col gap-1 whitespace-normal">
					<p className="break-all font-medium">{row.original.email}</p>
					<p className="text-sm text-muted-foreground">
						{row.original.phone ?? "No phone provided"}
					</p>
				</div>
			),
		},
		{
			accessorKey: "notes",
			header: "Notes",
			cell: ({ row }) => (
				<p className="whitespace-normal text-sm text-muted-foreground">
					{row.original.notes?.trim() || "No notes"}
				</p>
			),
		},
		{
			id: "createdAt",
			accessorFn: (row) => row.pendingPaymentCreatedAt,
			header: ({ column }) => renderSortableHeader("Created", column),
			cell: ({ row }) => (
				<p className="min-w-44 font-medium whitespace-normal">
					{formatBookingTimestamp(row.original.pendingPaymentCreatedAt)}
				</p>
			),
		},
		{
			id: "actions",
			enableHiding: false,
			cell: ({ row }) => <BookingActions booking={row.original} />,
		},
	];
}

function AdminMetricCard({
	title,
	value,
	description,
	variant,
	className,
}: {
	title: string;
	value: string;
	description?: string;
	variant?: React.ComponentProps<typeof Badge>["variant"];
	className?: string;
}) {
	return (
		<Card>
			<CardHeader>
				<CardDescription>{title}</CardDescription>
				<CardTitle className="text-3xl">{value}</CardTitle>
				{description ? (
					<CardAction>
						<Badge
							variant={variant ?? "outline"}
							className={className}>
							{description}
						</Badge>
					</CardAction>
				) : null}
			</CardHeader>
		</Card>
	);
}

export function AdminDashboard({
	bookings,
	canLoadMoreBookings,
	email,
	isLoadingMoreBookings,
	loadMoreBookings,
	signOutControl,
}: AdminDashboardProps) {
	const cleanupOldBookings = useMutation(api.bookings.cleanupOldPendingAndExpiredBookings);
	const columns = React.useMemo(() => buildColumns(), []);
	const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }]);
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
	const [showUpcomingOnly, setShowUpcomingOnly] = React.useState(true);
	const [hideStaleBookings, setHideStaleBookings] = React.useState(false);
	const [isCleanupDialogOpen, setIsCleanupDialogOpen] = React.useState(false);
	const [isCleaningUp, setIsCleaningUp] = React.useState(false);
	const staleCleanupBookings = React.useMemo(
		() => bookings.filter((booking) => isStaleCleanupBooking(booking)),
		[bookings],
	);
	const filteredBookings = React.useMemo(() => {
		return bookings.filter((booking) => {
			if (showUpcomingOnly && !isUpcomingBooking(booking.date, booking.time)) {
				return false;
			}

			if (hideStaleBookings && isStaleCleanupBooking(booking)) {
				return false;
			}

			return true;
		});
	}, [bookings, hideStaleBookings, showUpcomingOnly]);

	async function handleCleanupOldBookings() {
		setIsCleaningUp(true);

		try {
			const result = await cleanupOldBookings({});
			setIsCleanupDialogOpen(false);
			toast.success(
				result.deletedCount === 1
					? "Deleted 1 stale booking."
					: `Deleted ${result.deletedCount} stale bookings.`,
			);
		} catch {
			toast.error("Unable to clean up old bookings.");
		} finally {
			setIsCleaningUp(false);
		}
	}

	const table = useReactTable({
		data: filteredBookings,
		columns,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		initialState: {
			pagination: {
				pageSize: 12,
			},
		},
		state: {
			sorting,
			columnFilters,
		},
	});

	const metrics = React.useMemo(() => {
		const startOfWeekTimestamp = getStartOfWeekTimestamp();
		const counts = filteredBookings.reduce(
			(accumulator, booking) => {
				accumulator.total += 1;
				accumulator[booking.status] += 1;
				if (
					booking.status === "confirmed" &&
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
				expired: 0,
				failed: 0,
				pending_payment: 0,
			},
		);

		return counts;
	}, [filteredBookings]);

	const staleCounts = React.useMemo(
		() =>
			staleCleanupBookings.reduce(
				(accumulator, booking) => {
					accumulator[booking.status] += 1;
					return accumulator;
				},
				{
					abandoned: 0,
					confirmed: 0,
					expired: 0,
					failed: 0,
					pending_payment: 0,
				},
			),
		[staleCleanupBookings],
	);

	return (
		<main className="flex flex-col gap-6 pb-8">
			<section className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/60 p-5 shadow-sm backdrop-blur md:p-6">
				<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<div className="flex flex-col gap-2">
						<Badge variant="outline">Admin</Badge>
						<h1 className="text-4xl tracking-wide text-foreground font-medium">
							Bookings Dashboard
						</h1>
					</div>
					<div className="flex flex-col items-start gap-3 md:items-end">
						<p className="text-sm text-muted-foreground">Signed in as {email ?? "Unknown user"}.</p>
						{signOutControl}
					</div>
				</div>
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					<AdminMetricCard
						title="Confirmed this week"
						value={String(metrics.thisWeek)}
					/>
					<AdminMetricCard
						title="Confirmed"
						value={String(metrics.confirmed)}
						description="Ready for production"
						variant="default"
						className="bg-green-600 text-white hover:bg-green-600/90"
					/>
					<AdminMetricCard
						title="Pending payment"
						value={String(metrics.pending_payment)}
						description="Awaiting Stripe completion"
						variant="secondary"
						className="bg-cyan-600 text-white hover:bg-cyan-600/90"
					/>
					<AdminMetricCard
						title="Failed"
						value={String(metrics.failed)}
						description="Needs follow-up"
						variant="destructive"
					/>
				</div>
			</section>

			<Card className="overflow-hidden">
				<CardContent className="flex flex-col gap-4">
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<Input
							placeholder="Search bookings..."
							value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
							onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
							className="w-full md:max-w-sm"
						/>
						<div className="flex flex-wrap items-center gap-3">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setIsCleanupDialogOpen(true)}
								disabled={isCleaningUp || staleCleanupBookings.length === 0}>
								<Trash2 aria-hidden />
								Clean up stale bookings
							</Button>
							<div className="flex items-center gap-2">
								<Checkbox
									id="hide-stale-bookings"
									checked={hideStaleBookings}
									onCheckedChange={(checked) => setHideStaleBookings(checked === true)}
								/>
								<Label
									htmlFor="hide-stale-bookings"
									className="text-sm font-medium text-foreground">
									Hide stale bookings
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
									Show only upcoming sessions
								</Label>
							</div>
						</div>
					</div>

					<div className="overflow-hidden rounded-xl border">
						<Table className="table-fixed">
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
									table.getRowModel().rows.map((row) => (
										<TableRow key={row.id}>
											{row.getVisibleCells().map((cell) => (
												<TableCell
													key={cell.id}
													className={getColumnClassName(cell.column.id)}>
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</TableCell>
											))}
										</TableRow>
									))
								) : (
									<TableRow>
										<TableCell
											colSpan={table.getVisibleLeafColumns().length}
											className="h-24 text-center text-muted-foreground">
											{bookings.length === 0
												? "No bookings yet. L business."
												: "No bookings yet. L business."}
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>

					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div className="flex flex-wrap items-center gap-2">
							<p className="text-sm text-muted-foreground">
								Showing {table.getFilteredRowModel().rows.length}{" "}
								{table.getFilteredRowModel().rows.length === 1 ? "booking" : "bookings"} ·{" "}
								{bookings.length} {bookings.length === 1 ? "booking" : "bookings"} loaded
							</p>
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
						<div className="flex flex-wrap items-center gap-2">
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
				</CardContent>
			</Card>

			<Dialog
				open={isCleanupDialogOpen}
				onOpenChange={setIsCleanupDialogOpen}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Clean up stale bookings?</DialogTitle>
						<DialogDescription>
							This will permanently delete stale booking records from the database.
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
							{isCleaningUp ? "Deleting..." : "Delete stale bookings"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
}
