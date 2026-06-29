import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Column, ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import CopyIcon from "#/components/ui/copy-icon";
import { cn } from "#/lib/utils";
import { BookingActions } from "#studio/features/admin/components/BookingActions";
import {
	bookingStatusBadgeClassNameMap,
	bookingStatusBadgeVariantMap,
	bookingStatusLabelMap,
	deliverableStatusBadgeClassNameMap,
	deliverableStatusBadgeVariantMap,
	deliverableStatusLabelMap,
	getDeliverableStatus,
	isDeliverableSession
} from "#studio/features/admin/lib/booking-edit-status";
import {
	formatAudAmount,
	getRemainingBalanceAmount
} from "#studio/features/admin/lib/remaining-balance";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { formatEditingAddonLabel } from "#studio/features/booking-form/lib/editing-addon-quantities";
import {
	formatBookingDateMedium,
	formatBookingRelativeDate,
	formatBookingTimestamp,
	formatBookingTimeLabel,
	getBookingStartTimestamp
} from "#studio/lib/bookingdatetime";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";

export function getColumnClassName(columnId: string) {
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
				className={cn(
					"inline-flex size-5 shrink-0 items-center justify-center",
					"rounded-sm",
					"text-muted-foreground",
					"hover:text-foreground",
					"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				)}
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
		// Let users include the @ symbol when searching for displayed handles.
		row.original.instagramHandle ? formatInstagramHandle(row.original.instagramHandle) : null,
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

export function buildSessionsDashboardColumns(): ColumnDef<BookingRecord>[] {
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
