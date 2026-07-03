import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Column } from "@tanstack/react-table";
import { toast } from "sonner";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import { Button } from "#/components/ui/button";
import CopyIcon from "#/components/ui/copy-icon";
import { cn } from "#/lib/utils";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";

export function formatInstagramHandle(instagramHandle: string) {
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

export function CopyableText({ value, label, children }: CopyableTextProps) {
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

export function customerFilter(row: { original: BookingRecord }, value: unknown) {
	const query = String(value ?? "")
		.trim()
		.toLowerCase();

	if (!query) {
		return true;
	}

	const invoiceNumber =
		row.original.multiBookingInvoiceNumber ??
		formatBookingInvoiceNumber(row.original._id, row.original.pendingPaymentCreatedAt);

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

export function renderSortableHeader(label: string, column: Column<BookingRecord>) {
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
