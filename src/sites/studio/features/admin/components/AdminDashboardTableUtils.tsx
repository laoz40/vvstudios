import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import { Button } from "#/components/ui/button";
import CopyIcon from "#/components/ui/copy-icon";
import { cn } from "#/lib/utils";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";

export function formatInstagramHandle(instagramHandle: string) {
	const trimmedHandle = instagramHandle.trim();

	return trimmedHandle.startsWith("@") ? trimmedHandle : `@${trimmedHandle}`;
}

export async function copyText(value: string, label: string) {
	try {
		await navigator.clipboard.writeText(value);
		toast.success(`Copied ${label}.`);
	} catch {
		toast.error(`Unable to copy ${label}.`);
	}
}

type CopyableTextProps = {
	children: ReactNode;
	label: string;
	onTextClick?: () => void;
	value: string;
};

type SortHeaderButtonProps = {
	isActive: boolean;
	isDescending: boolean;
	label: string;
	onClick: () => void;
};

function getSortHeaderIcon(isActive: boolean, isDescending: boolean) {
	if (!isActive) {
		return ArrowUpDown;
	}

	return isDescending ? ArrowDown : ArrowUp;
}

export function SortHeaderButton({
	isActive,
	isDescending,
	label,
	onClick
}: SortHeaderButtonProps) {
	const SortIcon = getSortHeaderIcon(isActive, isDescending);

	return (
		<Button
			variant="ghost"
			className={cn("px-0!", "text-foreground")}
			onClick={onClick}>
			<span>{label}</span>
			<SortIcon
				data-icon="inline-end"
				className={cn(isActive ? "opacity-100" : "opacity-60")}
			/>
		</Button>
	);
}

export function CopyableText({ value, label, children, onTextClick }: CopyableTextProps) {
	return (
		<span className="inline-flex items-center gap-1 align-baseline">
			{onTextClick ? (
				<button
					type="button"
					className="cursor-pointer text-left"
					onClick={onTextClick}
					aria-label={`Hide ${label}`}>
					{children}
				</button>
			) : (
				<span>{children}</span>
			)}
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
				<button
					aria-label={`Copy ${label}`}
					onClick={() => void copyText(value, label)}
				/>
			</AnimatedIconButton>
		</span>
	);
}

export function customerFilter(row: { original: SessionRecord }, value: unknown) {
	const parsedValue = z.string().safeParse(value);
	const query = parsedValue.success ? parsedValue.data.trim().toLowerCase() : "";

	if (!query) {
		return true;
	}

	const invoiceNumber =
		row.original.packageInvoiceNumber ??
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
