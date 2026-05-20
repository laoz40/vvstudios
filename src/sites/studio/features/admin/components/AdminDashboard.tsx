import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
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
import { ArrowDown, ArrowUp, ArrowUpDown, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import { Badge } from "#/components/ui/badge";
import { Checkbox } from "#/components/ui/checkbox";
import { Button } from "#/components/ui/button";
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
	readStoredAdminDashboardSorting,
	readStoredShowStaleBookings,
	readStoredShowUpcomingOnly,
	storeAdminDashboardSorting,
	storeShowStaleBookings,
	storeShowUpcomingOnly,
} from "#studio/features/admin/lib/admin-dashboard-preferences";
import {
	formatAudAmount,
	getRemainingBalanceAmount,
} from "#studio/features/admin/lib/remaining-balance";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import {
	formatBookingDateMedium,
	formatBookingTimestamp,
	formatBookingTimeLabel,
	getBookingStartTimestamp,
	getStartOfWeekTimestamp,
	isUpcomingBooking,
} from "#studio/lib/bookingdatetime";
import { AdminAvailabilitySettings } from "#studio/features/admin/components/AdminAvailabilitySettings";
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
	signOutControl: ReactNode;
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
	ComponentProps<typeof Badge>["variant"]
> = {
	abandoned: "outline",
	confirmed: "default",
	expired: "outline",
	failed: "destructive",
	pending_payment: "secondary",
};

const statusBadgeClassNameMap: Record<AdminBookingRecord["status"], string | undefined> = {
	abandoned: "bg-muted text-muted-foreground",
	confirmed: "bg-green-600 text-foreground",
	expired: "bg-muted text-muted-foreground",
	failed: undefined,
	pending_payment: "bg-cyan-600 text-foreground",
};

function getColumnClassName(columnId: string) {
	switch (columnId) {
		case "name":
			return "w-42";
		case "status":
			return "w-18";
		case "session":
			return "w-16";
		case "service":
			return "w-50";
		case "contact":
			return "w-42";
		case "notes":
			return "w-56";
		case "paidRemainingBalance":
			return "w-8";
		case "createdAt":
			return "w-20";
		case "actions":
			return "w-6";
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

function formatInstagramHandle(instagramHandle: string) {
	const trimmedHandle = instagramHandle.trim();

	return trimmedHandle.startsWith("@") ? trimmedHandle : `@${trimmedHandle}`;
}

async function copyText(value: string, label: string) {
	try {
		await navigator.clipboard.writeText(value);
		toast.success(`Copied ${label}.`);
	} catch {
		toast.error(`Unable to copy ${label}.`);
	}
}

type CopyableTextProps = {
	value: string;
	label: string;
	children: ReactNode;
};

function CopyableText({ value, label, children }: CopyableTextProps) {
	return (
		<span className="inline-flex items-center gap-1 align-baseline">
			<span>{children}</span>
			<Button
				type="button"
				size="icon-sm"
				variant="ghost"
				aria-label={`Copy ${label}`}
				className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:cursor-grab active:cursor-grabbing"
				onClick={() => void copyText(value, label)}>
				<Copy className="size-3" />
			</Button>
		</span>
	);
}

function customerFilter(row: { original: AdminBookingRecord }, value: unknown) {
	const query = String(value ?? "")
		.trim()
		.toLowerCase();

	if (!query) {
		return true;
	}

	const invoiceNumber = formatBookingInvoiceNumber(
		row.original._id,
		row.original.pendingPaymentCreatedAt,
	);

	return [
		row.original._id,
		invoiceNumber,
		row.original.name,
		row.original.email,
		row.original.accountName,
		row.original.phone,
		row.original.instagramHandle,
		row.original.service,
		row.original.date,
	]
		.filter((field): field is string => Boolean(field))
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
					<p className="font-medium">
						<CopyableText
							value={row.original.name}
							label="customer name">
							{row.original.name}
						</CopyableText>
					</p>
					{row.original.accountName || row.original.abn ? (
						<p className="text-sm text-muted-foreground">
							{row.original.accountName ? (
								<CopyableText
									value={row.original.accountName}
									label="account name">
									{row.original.accountName}
								</CopyableText>
							) : null}
							{row.original.abn ? (
								<>
									{row.original.accountName ? " · " : ""}
									<CopyableText
										value={row.original.abn}
										label="ABN">
										{row.original.abn}
									</CopyableText>
								</>
							) : null}
						</p>
					) : null}
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
			accessorFn: (row) => `${row.email} ${row.phone ?? ""} ${row.instagramHandle ?? ""}`,
			cell: ({ row }) => (
				<div className="flex flex-col gap-1 whitespace-normal">
					<p className="break-all font-medium">
						<CopyableText
							value={row.original.email}
							label="email">
							{row.original.email}
						</CopyableText>
					</p>
					<p className="text-sm text-muted-foreground">
						{row.original.phone ? (
							<CopyableText
								value={row.original.phone}
								label="phone number">
								{row.original.phone}
							</CopyableText>
						) : (
							<span>No phone provided</span>
						)}
						{row.original.instagramHandle ? (
							<>
								{" · "}
								<CopyableText
									value={formatInstagramHandle(row.original.instagramHandle)}
									label="Instagram handle">
									{formatInstagramHandle(row.original.instagramHandle)}
								</CopyableText>
							</>
						) : null}
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
			accessorKey: "paidRemainingBalance",
			header: "Due",
			cell: ({ row }) => {
				if (row.original.status !== "confirmed") {
					return null;
				}

				const isPaid = row.original.paidRemainingBalance === true;
				const remainingBalanceLabel = formatAudAmount(getRemainingBalanceAmount(row.original));

				return (
					<p className={isPaid ? "text-green-500" : "text-destructive"}>
						{isPaid ? "Paid" : remainingBalanceLabel}
					</p>
				);
			},
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

function AdminMetricCard({ value }: { value: number }) {
	return (
		<div className="flex items-center">
			<p className="text-sm text-muted-foreground">
				{value} {value === 1 ? "booking" : "bookings"} made this week
			</p>
		</div>
	);
}

function AdminStatusMetric({
	label,
	value,
	variant,
	className,
}: {
	label: string;
	value: string;
	variant?: ComponentProps<typeof Badge>["variant"];
	className?: string;
}) {
	return (
		<div className="flex items-center justify-between w-28">
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
	signOutControl,
}: AdminDashboardProps) {
	const cleanupOldBookings = useMutation(api.bookings.cleanupOldPendingAndExpiredBookings);
	const columns = useMemo(() => buildColumns(), []);
	const [sorting, setSorting] = useState<SortingState>(() => readStoredAdminDashboardSorting());
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [showUpcomingOnly, setShowUpcomingOnly] = useState(() => readStoredShowUpcomingOnly());
	const [showStaleBookings, setShowStaleBookings] = useState(() => readStoredShowStaleBookings());
	const [isCleanupDialogOpen, setIsCleanupDialogOpen] = useState(false);
	const [isCleaningUp, setIsCleaningUp] = useState(false);
	const staleCleanupBookings = useMemo(
		() => bookings.filter((booking) => isStaleCleanupBooking(booking)),
		[bookings],
	);
	useEffect(() => {
		storeAdminDashboardSorting(sorting);
	}, [sorting]);

	useEffect(() => {
		storeShowUpcomingOnly(showUpcomingOnly);
	}, [showUpcomingOnly]);

	useEffect(() => {
		storeShowStaleBookings(showStaleBookings);
	}, [showStaleBookings]);

	const filteredBookings = useMemo(() => {
		return bookings.filter((booking) => {
			if (showUpcomingOnly && !isUpcomingBooking(booking.date, booking.time)) {
				return false;
			}

			if (!showStaleBookings && isStaleCleanupBooking(booking)) {
				return false;
			}

			return true;
		});
	}, [bookings, showStaleBookings, showUpcomingOnly]);

	async function handleCleanupOldBookings() {
		setIsCleaningUp(true);

		try {
			const result = await cleanupOldBookings({});
			setIsCleanupDialogOpen(false);
			toast.success(
				result.deletedCount === 1
					? "Deleted 1 incomplete booking."
					: `Deleted ${result.deletedCount} incomplete bookings.`,
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

	const metrics = useMemo(() => {
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

	const staleCounts = useMemo(
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
		<main className="flex min-h-screen flex-col gap-6 bg-card p-4 pb-8 lg:px-6">
			<section className="flex flex-col gap-5">
				<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-10">
						<h1
							title="It would look better if the text were bigger. What do you think, Joseph?"
							className="font-brand text-[10rem] leading-none font-medium uppercase text-foreground cursor-help">
							Bookings Dashboard
						</h1>
						<div className="flex flex-wrap flex-col items-start gap-2">
							<AdminStatusMetric
								label="Confirmed"
								value={String(metrics.confirmed)}
								variant="default"
								className="bg-green-600 text-foreground"
							/>
							<AdminStatusMetric
								label="Pending"
								value={String(metrics.pending_payment)}
								variant="secondary"
								className="bg-cyan-600 text-foreground"
							/>
							<AdminStatusMetric
								label="Failed"
								value={String(metrics.failed)}
								variant="destructive"
							/>
						</div>
					</div>
					<div className="flex flex-col items-start gap-3 md:items-end">
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
						<AdminMetricCard value={metrics.thisWeek} />
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<div className="flex items-center gap-2">
							<Checkbox
								id="show-stale-bookings"
								checked={showStaleBookings}
								onCheckedChange={(checked) => setShowStaleBookings(checked === true)}
							/>
							<Label
								htmlFor="show-stale-bookings"
								className="text-sm font-medium text-foreground">
								Show incomplete bookings
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

				<div className="overflow-hidden border-y">
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
								table.getRowModel().rows.map((row) => {
									const isPastBooking = !isUpcomingBooking(row.original.date, row.original.time);

									return (
										<TableRow
											key={row.id}
											className={cn(
												!showUpcomingOnly &&
													isPastBooking &&
													"bg-muted/40 text-muted-foreground opacity-70",
											)}>
											{row.getVisibleCells().map((cell) => (
												<TableCell
													key={cell.id}
													className={getColumnClassName(cell.column.id)}>
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
					<div className="flex flex-wrap items-center gap-6">
						<p className="text-sm text-muted-foreground">
							Showing {table.getFilteredRowModel().rows.length}{" "}
							{table.getFilteredRowModel().rows.length === 1 ? "booking" : "bookings"} ·{" "}
							{bookings.length} {bookings.length === 1 ? "booking" : "bookings"} loaded
						</p>
						<Button
							variant="ghost"
							size="sm"
							className="text-sm!"
							onClick={() => setIsCleanupDialogOpen(true)}
							disabled={isCleaningUp || staleCleanupBookings.length === 0}>
							<Trash2 aria-hidden />
							Clean up incomplete bookings
						</Button>
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
			</section>

			<Dialog
				open={isCleanupDialogOpen}
				onOpenChange={setIsCleanupDialogOpen}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Clean up incomplete bookings?</DialogTitle>
						<DialogDescription>
							This will permanently delete incomplete booking records from the database.
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
							{isCleaningUp ? "Deleting..." : "Delete incomplete bookings"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
}
