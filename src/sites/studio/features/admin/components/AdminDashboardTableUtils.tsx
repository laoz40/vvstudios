import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import { Button } from "#/components/ui/button";
import CopyIcon from "#/components/ui/copy-icon";
import { TableCell, TableRow } from "#/components/ui/table";

export function formatInstagramHandle(instagramHandle: string) {
	const trimmedHandle = instagramHandle.trim();

	return trimmedHandle.startsWith("@") ? trimmedHandle : `@${trimmedHandle}`;
}

export function AdminTableInlineFieldSeparator() {
	return (
		<span
			className="shrink-0 px-1"
			aria-hidden>
			·
		</span>
	);
}

export async function copyText(value: string, label: string, successMessage = `Copied ${label}.`) {
	try {
		await navigator.clipboard.writeText(value);
		toast.success(successMessage);
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

export function SortHeaderButton({
	isActive,
	isDescending,
	isLoading = false,
	label,
	onClick
}: SortHeaderButtonProps) {
	let icon = (
		<ArrowUpDown
			data-icon="inline-end"
			className="opacity-60"
		/>
	);

	if (isLoading) {
		icon = (
			<LoaderCircle
				data-icon="inline-end"
				className="size-4 animate-spin"
				aria-hidden
			/>
		);
	} else if (isActive && isDescending) {
		icon = <ArrowDown data-icon="inline-end" />;
	} else if (isActive) {
		icon = <ArrowUp data-icon="inline-end" />;
	}

	return (
		<Button
			variant="ghost"
			className="px-0! text-foreground"
			disabled={isLoading}
			onClick={onClick}>
			<span>{label}</span>
			{icon}
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
					className="cursor-pointer text-left select-text"
					onClick={onTextClick}
					aria-label={`Hide ${label}`}>
					{children}
				</button>
			) : (
				<span className="select-text">{children}</span>
			)}
			<AnimatedIconButton
				type="button"
				size="icon-sm"
				variant="ghost"
				aria-label={`Copy ${label}`}
				className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				icon={CopyIcon}
				iconProps={{ size: 12, "aria-hidden": true }}>
				<button
					aria-label={`Copy ${label}`}
					onClick={() => void copyText(value, label)}
				/>
			</AnimatedIconButton>
		</span>
	);
}
