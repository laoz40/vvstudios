import { useState, type ReactNode } from "react";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import CopyIcon from "#/components/ui/copy-icon";
import MagnifierIcon from "#/components/ui/magnifier-icon";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { cn } from "#/lib/utils";
import { copyText } from "#studio/features/admin/components/AdminDashboardTableUtils";
import { formatAdminSearchNarrowQuery } from "#studio/features/admin/lib/admin-search-narrow";

export type AdminSearchFieldPopoverExtraField = {
	fieldLabel: string;
	searchPrefix: string;
	value: string;
};

type AdminSearchFieldPopoverProps = {
	additionalFields?: AdminSearchFieldPopoverExtraField[];
	children: ReactNode;
	className?: string;
	fieldLabel: string;
	onSearch: (searchQuery: string) => void;
	searchPrefix: string;
	value: string;
};

function AdminSearchFieldPopoverSection({
	fieldLabel,
	onClose,
	onSearch,
	searchPrefix,
	value
}: {
	fieldLabel: string;
	onClose?: () => void;
	onSearch: (searchQuery: string) => void;
	searchPrefix: string;
	value: string;
}) {
	return (
		<div>
			<p className="text-xs text-muted-foreground capitalize">{fieldLabel}</p>
			<p className="mt-1 text-sm break-all text-foreground">{value}</p>
			<div className="mt-2 flex gap-2">
				<AnimatedIconButton
					type="button"
					variant="outline"
					size="sm"
					iconPosition="before"
					className="text-foreground"
					renderIcon={(iconRef) => (
						<CopyIcon
							ref={iconRef}
							size={14}
							aria-hidden
						/>
					)}>
					<button
						type="button"
						aria-label={`Copy ${fieldLabel}`}
						onClick={() => void copyText(value, fieldLabel)}>
						Copy
					</button>
				</AnimatedIconButton>
				<AnimatedIconButton
					type="button"
					variant="outline"
					size="sm"
					iconPosition="before"
					className="text-foreground"
					renderIcon={(iconRef) => (
						<MagnifierIcon
							ref={iconRef}
							size={14}
							aria-hidden
						/>
					)}>
					<button
						type="button"
						aria-label={`Search by ${fieldLabel}`}
						onClick={() => {
							onSearch(formatAdminSearchNarrowQuery(searchPrefix, value));
							onClose?.();
						}}>
						Search
					</button>
				</AnimatedIconButton>
			</div>
		</div>
	);
}

export function AdminSearchFieldPopover({
	additionalFields,
	children,
	className,
	fieldLabel,
	onSearch,
	searchPrefix,
	value
}: AdminSearchFieldPopoverProps) {
	const [open, setOpen] = useState(false);

	return (
		<Popover
			open={open}
			onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					title={value}
					className={cn(
						"font-inherit inline-block max-w-full min-w-0 cursor-pointer text-left align-baseline leading-none text-foreground underline-offset-4 hover:underline hover:decoration-primary",
						className
					)}>
					<span className="inline-block max-w-full min-w-0 truncate align-baseline leading-none">
						{children}
					</span>
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-auto min-w-40">
				<AdminSearchFieldPopoverSection
					fieldLabel={fieldLabel}
					onClose={() => setOpen(false)}
					onSearch={onSearch}
					searchPrefix={searchPrefix}
					value={value}
				/>
				{additionalFields?.map((extraField) => (
					<div
						key={extraField.searchPrefix}
						className="mt-4 border-t pt-3">
						<AdminSearchFieldPopoverSection
							fieldLabel={extraField.fieldLabel}
							onClose={() => setOpen(false)}
							onSearch={onSearch}
							searchPrefix={extraField.searchPrefix}
							value={extraField.value}
						/>
					</div>
				))}
			</PopoverContent>
		</Popover>
	);
}
