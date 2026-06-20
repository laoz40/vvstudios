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
	useReactTable
} from "@tanstack/react-table";
import { useMutation } from "convex/react";
import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter, Menu } from "lucide-react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { CleanupOldPendingAndExpiredBookingsResult } from "#convex/bookings";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import CopyIcon from "#/components/ui/copy-icon";
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
import { BookingActions } from "#studio/features/admin/components/BookingActions";
import {
	readStoredAdminDashboardSorting,
	readStoredShowStaleBookings,
	readStoredShowUpcomingOnly,
	storeAdminDashboardSorting,
	storeShowStaleBookings,
	storeShowUpcomingOnly
} from "#studio/features/admin/lib/admin-dashboard-preferences";
import {
	bookingStatusBadgeClassNameMap,
	bookingStatusBadgeVariantMap,
	bookingStatusLabelMap,
	deliverableStatusBadgeClassNameMap,
	deliverableStatusBadgeVariantMap,
	deliverableStatusLabelMap,
	getDeliverableStatus,
	hasUnsentDeliverables,
	isDeliverableSession
} from "#studio/features/admin/lib/booking-edit-status";
import { formatEditingAddonLabel } from "#studio/features/booking-form/lib/editing-addon-quantities";
import {
	formatAudAmount,
	getRemainingBalanceAmount,
	hasUnpaidRemainingBalance
} from "#studio/features/admin/lib/remaining-balance";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import {
	formatBookingDateMedium,
	formatBookingRelativeDate,
	formatBookingTimestamp,
	formatBookingTimeLabel,
	getBookingStartTimestamp,
	getStartOfWeekTimestamp,
	isUpcomingBooking
} from "#studio/lib/bookingdatetime";
import { AdminAvailabilitySettings } from "#studio/features/admin/components/AdminAvailabilitySettings";
import { cn } from "#/lib/utils";
import { tryCatch } from "#/lib/result";

type BookingRecord = Doc<"bookings">;

const STRIPE_CHECKOUT_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

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

function getColumnClassName(columnId: string) {
	switch (columnId) {
		case "name":
			return "w-36";
		case "status":
			return "w-24 md:w-16";
		case "session":
			return "w-28 md:w-16";
		case "service":
			return "w-44";
		case "contact":
			return "w-56 md:w-36";
		case "notes":
			return "w-56";
		case "paidRemainingBalance":
			return "w-16 md:w-8";
		case "editStatus":
			return "w-24 md:w-16";
		case "createdAt":
			return "w-36 md:w-20";
		case "actions":
			return "w-12 md:w-6";
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
type CopyableTextProps = { value: string; label: string; children: ReactNode };

function CopyableText({ value, label, children }: CopyableTextProps) {
	return (
		<span className="inline-flex items-center gap-1 align-baseline">
			<span>{children}</span>
			<AnimatedIconButton
				type="button"
				size="icon-sm"
				variant="ghost"
				aria-label={`Copy ${label}`}
				className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				renderIcon={(iconRef) => (
					<CopyIcon
						ref={iconRef}
						size={12}
						aria-hidden
					/>
				)}>
				<button onClick={() => void copyText(value, label)} />
			</AnimatedIconButton>
		</span>
	);
}

function customerFilter(row: { original: BookingRecord }, value: unknown) {
	const query = String(value ?? "")
		.trim()
		.toLowerCase();

	if (!query) {
		return true;
	}

	const invoiceNumber = formatBookingInvoiceNumber(
		row.original._id,
		row.original.pendingPaymentCreatedAt
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
		row.original.date
	]
		.filter((field): field is string => Boolean(field))
		.some((field) => field.toLowerCase().includes(query));
}

function renderSortableHeader(label: string, column: Column<BookingRecord>) {
	const sortDirection = column.getIsSorted();
	const SortIcon =
		sortDirection === "asc" ? ArrowUp : sortDirection === "desc" ? ArrowDown : ArrowUpDown;

	return (
		<Button
			variant="ghost"
			className={cn(
				"px-0!",
				sortDirection ? "text-foreground" : "text-muted-foreground hover:text-foreground"
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

function buildColumns(): ColumnDef<BookingRecord>[] {
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
						<p className="text-sm">
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
			filterFn: (row, _columnId, value) => customerFilter(row, value)
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => (
				<Badge
					variant={bookingStatusBadgeVariantMap[row.original.status]}
					className={bookingStatusBadgeClassNameMap[row.original.status]}>
					{bookingStatusLabelMap[row.original.status]}
				</Badge>
			)
		},
		{
			id: "session",
			accessorFn: (row) => getBookingStartTimestamp(row.date, row.time),
			header: ({ column }) => renderSortableHeader("Session", column),
			cell: ({ row }) => {
				const relativeDateLabel = formatBookingRelativeDate(row.original.date);

				return (
					<div
						className="flex cursor-help flex-col gap-1 whitespace-normal"
						title={relativeDateLabel}>
						<p className="font-medium">{formatBookingDateMedium(row.original.date)}</p>
						<p className="text-sm">
							{formatBookingTimeLabel(row.original.time)}
							{row.original.duration ? ` · ${row.original.duration}` : ""}
						</p>
					</div>
				);
			}
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
									{formatEditingAddonLabel(addon, row.original)}
								</Badge>
							))}
						</div>
					) : (
						<p className="text-sm text-muted-foreground">No add-ons</p>
					)}
				</div>
			)
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
					<p className="text-sm">
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
			)
		},
		{
			accessorKey: "notes",
			header: "Notes",
			cell: ({ row }) => (
				<p className="whitespace-normal text-sm text-muted-foreground">
					{row.original.notes?.trim() || "No notes"}
				</p>
			)
		},
		{
			accessorKey: "paidRemainingBalance",
			header: "Due",
			cell: ({ row }) => {
				if (row.original.status !== "confirmed" && row.original.status !== "email_failed") {
					return null;
				}

				const isPaid = row.original.paidRemainingBalance === true;
				const remainingBalanceLabel = formatAudAmount(getRemainingBalanceAmount(row.original));

				return (
					<p className={isPaid ? "text-green" : "text-destructive"}>
						{isPaid ? "Paid" : remainingBalanceLabel}
					</p>
				);
			}
		},
		{
			id: "editStatus",
			header: "Deliverables",
			cell: ({ row }) => {
				if (!isDeliverableSession(row.original)) {
					return null;
				}

				const deliverableStatus = getDeliverableStatus(row.original);

				return (
					<Badge
						variant={deliverableStatusBadgeVariantMap[deliverableStatus]}
						className={deliverableStatusBadgeClassNameMap[deliverableStatus]}>
						{deliverableStatusLabelMap[deliverableStatus]}
					</Badge>
				);
			}
		},
		{
			id: "createdAt",
			accessorFn: (row) => row.pendingPaymentCreatedAt,
			header: ({ column }) => renderSortableHeader("Created", column),
			cell: ({ row }) => (
				<p className="min-w-44 font-medium whitespace-normal">
					{formatBookingTimestamp(row.original.pendingPaymentCreatedAt)}
				</p>
			)
		},
		{
			id: "actions",
			enableHiding: false,
			cell: ({ row }) => <BookingActions booking={row.original} />
		}
	];
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
	const columns = useMemo(() => buildColumns(), []);
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
		<main className="relative flex min-h-screen flex-col gap-5 bg-card p-3 pb-8 md:gap-6 md:p-4 lg:px-6">
			<div className="absolute top-3 right-3 md:hidden">
				<AdminDashboardMenu
					email={email}
					signOutControl={signOutControl}
				/>
			</div>
			<section className="flex flex-col gap-4 pr-14 md:gap-5 md:pr-0">
				<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 xl:items-center xl:gap-10">
						<h1
							title="It would look better if the text were bigger. What do you think, Joseph?"
							className="font-brand text-4xl leading-none font-medium uppercase text-foreground cursor-help md:text-[10rem]">
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
						<div className="flex w-full items-center justify-between gap-3 md:w-auto md:justify-start md:gap-6">
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
