import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import { Button } from "#/components/ui/button";
import CopyIcon from "#/components/ui/copy-icon";
import { TableCell, TableRow } from "#/components/ui/table";
import { cn } from "#/lib/utils";

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
	isLoading?: boolean;
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
	isLoading = false,
	label,
	onClick
}: SortHeaderButtonProps) {
	const SortIcon = getSortHeaderIcon(isActive, isDescending);

	return (
		<Button
			variant="ghost"
			className="px-0! text-foreground"
			disabled={isLoading}
			onClick={onClick}>
			<span>{label}</span>
			{isLoading ? (
				<LoaderCircle
					data-icon="inline-end"
					className="size-4 animate-spin"
					aria-hidden
				/>
			) : (
				<SortIcon
					data-icon="inline-end"
					className={cn(isActive ? "opacity-100" : "opacity-60")}
				/>
			)}
		</Button>
	);
}

export function AdminTableLoadingRow({ colSpan, label }: { colSpan: number; label: string }) {
	return (
		<TableRow>
			<TableCell
				colSpan={colSpan}
				className="h-24 text-center text-muted-foreground">
				<span className="inline-flex items-center gap-2">
					<LoaderCircle
						className="size-4 animate-spin"
						aria-hidden
					/>
					{label}
				</span>
			</TableCell>
		</TableRow>
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
				className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
