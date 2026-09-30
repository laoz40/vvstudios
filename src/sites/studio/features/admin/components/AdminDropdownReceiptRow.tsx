import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import CopyIcon from "#/components/ui/copy-icon";
import MagnifierIcon from "#/components/ui/magnifier-icon";
import HashtagIcon from "#/components/ui/hashtag-icon";
import { copyText } from "#studio/features/admin/components/AdminDashboardTableUtils";
import { formatAdminSearchNarrowQuery } from "#studio/features/admin/lib/admin-search-narrow";

type AdminDropdownReceiptRowProps = {
	copyLabel: string;
	onSearch: (searchQuery: string) => void;
	value: string;
};

export function AdminDropdownReceiptRow({
	copyLabel,
	onSearch,
	value
}: AdminDropdownReceiptRowProps) {
	return (
		<div className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden [&_svg]:shrink-0">
			<HashtagIcon
				size={16}
				aria-hidden
				className="shrink-0 text-muted-foreground"
			/>
			<span className="min-w-0 flex-1 truncate select-text">{value}</span>
			<AnimatedIconButton
				type="button"
				size="icon-sm"
				variant="ghost"
				aria-label={`Copy ${copyLabel}`}
				className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
				renderIcon={(iconRef) => (
					<CopyIcon
						ref={iconRef}
						size={14}
						aria-hidden
					/>
				)}>
				<button
					type="button"
					aria-label={`Copy ${copyLabel}`}
					onClick={() => void copyText(value, copyLabel)}
				/>
			</AnimatedIconButton>
			<AnimatedIconButton
				type="button"
				size="icon-sm"
				variant="ghost"
				aria-label="Search by receipt"
				className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
				renderIcon={(iconRef) => (
					<MagnifierIcon
						ref={iconRef}
						size={14}
						aria-hidden
					/>
				)}>
				<button
					type="button"
					aria-label="Search by receipt"
					onClick={() => onSearch(formatAdminSearchNarrowQuery("receipt", value))}
				/>
			</AnimatedIconButton>
		</div>
	);
}
