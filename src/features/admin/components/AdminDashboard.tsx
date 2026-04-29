import * as React from "react";
import {
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
import { ArrowUpDown, MoreHorizontal } from "lucide-react";

import type { Doc } from "../../../../convex/_generated/dataModel";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { formatBookingInvoiceNumber } from "#/features/booking-invoice/lib/build-booking-invoice-data";

type BookingRecord = Doc<"bookings">;

export type AdminDashboardProps = {
	bookings: BookingRecord[];
	email: string | null;
	signOutControl: React.ReactNode;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "Australia/Sydney",
});

const dateFormatter = new Intl.DateTimeFormat("en-AU", {
	dateStyle: "medium",
	timeZone: "Australia/Sydney",
});

const statusLabelMap: Record<BookingRecord["status"], string> = {
	confirmed: "Confirmed",
	expired: "Expired",
	failed: "Failed",
	pending_payment: "Pending payment",
};

const statusBadgeVariantMap: Record<
	BookingRecord["status"],
	React.ComponentProps<typeof Badge>["variant"]
> = {
	confirmed: "default",
	expired: "outline",
	failed: "destructive",
	pending_payment: "secondary",
};

const statusBadgeClassNameMap: Record<BookingRecord["status"], string | undefined> = {
	confirmed: "bg-green-600 text-white hover:bg-green-600/90",
	expired: undefined,
	failed: undefined,
	pending_payment: "bg-blue-600 text-white hover:bg-blue-600/90",
};

function formatCreatedAt(value: number) {
	return dateTimeFormatter.format(value);
}

function getStartOfWeekTimestamp(now = new Date()) {
	const startOfWeek = new Date(now);
	const dayOfWeek = startOfWeek.getDay();
	const daysSinceMonday = (dayOfWeek + 6) % 7;

	startOfWeek.setHours(0, 0, 0, 0);
	startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);

	return startOfWeek.getTime();
}

function formatSessionDate(value: string) {
	const parsedDate = new Date(`${value}T00:00:00`);

	if (Number.isNaN(parsedDate.getTime())) {
		return value;
	}

	return dateFormatter.format(parsedDate);
}

function formatSessionTime(value: string | undefined) {
	if (!value) {
		return "Time TBD";
	}

	const parsedDate = new Date(`1970-01-01T${value}:00`);

	if (Number.isNaN(parsedDate.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat("en-AU", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
		timeZone: "Australia/Sydney",
	})
		.format(parsedDate)
		.toLowerCase();
}

function getColumnClassName(columnId: string) {
	switch (columnId) {
		case "name":
			return "w-44";
		case "status":
			return "w-24";
		case "session":
			return "w-32";
		case "service":
			return "w-64";
		case "contact":
			return "w-44";
		case "notes":
			return "w-56";
		case "createdAt":
			return "w-44";
		case "actions":
			return "w-10";
		default:
			return undefined;
	}
}

function customerFilter(row: { original: BookingRecord }, value: unknown) {
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

function buildColumns(): ColumnDef<BookingRecord>[] {
	return [
		{
			accessorKey: "name",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
					Customer
					<ArrowUpDown data-icon="inline-end" />
				</Button>
			),
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
			header: "Session",
			accessorFn: (row) => `${row.date} ${row.time ?? ""}`,
			cell: ({ row }) => (
				<div className="flex flex-col gap-1 whitespace-normal">
					<p className="font-medium">{formatSessionDate(row.original.date)}</p>
					<p className="text-sm text-muted-foreground">
						{formatSessionTime(row.original.time)}
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
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
					Created
					<ArrowUpDown data-icon="inline-end" />
				</Button>
			),
			cell: ({ row }) => (
				<p className="min-w-44 font-medium whitespace-normal">
					{formatCreatedAt(row.original.pendingPaymentCreatedAt)}
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

function BookingActions({ booking }: { booking: BookingRecord }) {
	const customerBookingId = formatBookingInvoiceNumber(
		booking._id,
		booking.pendingPaymentCreatedAt,
	);

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon-sm"
					className="touch-manipulation">
					<span className="sr-only">Open booking actions</span>
					<MoreHorizontal />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-48 touch-manipulation">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Booking</DropdownMenuLabel>
					<DropdownMenuItem onClick={() => navigator.clipboard.writeText(String(booking._id))}>
						Copy database ID
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => navigator.clipboard.writeText(customerBookingId)}>
						Copy booking ID
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => navigator.clipboard.writeText(booking.name)}>
						Copy customer name
					</DropdownMenuItem>
					{booking.accountName ? (
						<DropdownMenuItem onClick={() => navigator.clipboard.writeText(booking.accountName)}>
							Copy account name
						</DropdownMenuItem>
					) : null}
					{booking.abn ? (
						<DropdownMenuItem onClick={() => navigator.clipboard.writeText(booking.abn ?? "")}>
							Copy ABN
						</DropdownMenuItem>
					) : null}
					<DropdownMenuItem onClick={() => navigator.clipboard.writeText(booking.email)}>
						Copy email
					</DropdownMenuItem>
					{booking.phone ? (
						<DropdownMenuItem onClick={() => navigator.clipboard.writeText(booking.phone)}>
							Copy phone
						</DropdownMenuItem>
					) : null}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem asChild>
						<a href={`mailto:${booking.email}`}>Email customer</a>
					</DropdownMenuItem>
					{booking.phone ? (
						<DropdownMenuItem asChild>
							<a href={`tel:${booking.phone}`}>Call customer</a>
						</DropdownMenuItem>
					) : null}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
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

export function AdminDashboard({ bookings, email, signOutControl }: AdminDashboardProps) {
	const columns = React.useMemo(() => buildColumns(), []);
	const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }]);
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

	const table = useReactTable({
		data: bookings,
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
		const counts = bookings.reduce(
			(accumulator, booking) => {
				accumulator.total += 1;
				accumulator[booking.status] += 1;
				if (booking.pendingPaymentCreatedAt >= startOfWeekTimestamp) {
					accumulator.thisWeek += 1;
				}
				return accumulator;
			},
			{
				total: 0,
				thisWeek: 0,
				confirmed: 0,
				expired: 0,
				failed: 0,
				pending_payment: 0,
			},
		);

		return counts;
	}, [bookings]);

	return (
		<main className="flex flex-col gap-6 pb-8">
			<section className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/60 p-5 shadow-sm backdrop-blur md:p-6">
				<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<div className="flex flex-col gap-2">
						<Badge variant="outline">Admin</Badge>
						<h1 className="text-4xl tracking-wide text-foreground md:text-5xl">Bookings</h1>
					</div>
					<div className="flex flex-col items-start gap-3 md:items-end">
						<p className="text-sm text-muted-foreground">Signed in as {email ?? "Unknown user"}.</p>
						{signOutControl}
					</div>
				</div>
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					<AdminMetricCard
						title="Bookings made this week"
						value={String(metrics.thisWeek)}
					/>
					<AdminMetricCard
						title="Pending payment"
						value={String(metrics.pending_payment)}
						description="Awaiting Stripe completion"
						variant="secondary"
						className="bg-blue-600 text-white hover:bg-blue-600/90"
					/>
					<AdminMetricCard
						title="Confirmed"
						value={String(metrics.confirmed)}
						description="Ready for production"
						variant="default"
						className="bg-green-600 text-white hover:bg-green-600/90"
					/>
					<AdminMetricCard
						title="Failed or expired"
						value={String(metrics.failed + metrics.expired)}
						description="Needs follow-up"
						variant="destructive"
					/>
				</div>
			</section>

			<Card className="overflow-hidden">
				<CardContent className="flex flex-col gap-4">
					<div className="flex flex-col gap-3 md:flex-row md:items-center">
						<Input
							placeholder="Search bookings..."
							value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
							onChange={(event) => table.getColumn("name")?.setFilterValue(event.target.value)}
							className="w-full md:max-w-sm"
						/>
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
												? "No bookings yet."
												: "No bookings match the current filters."}
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>

					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<p className="text-sm text-muted-foreground">
							Showing {table.getRowModel().rows.length} of {table.getFilteredRowModel().rows.length}{" "}
							filtered bookings.
						</p>
						<div className="flex items-center gap-2">
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
		</main>
	);
}
