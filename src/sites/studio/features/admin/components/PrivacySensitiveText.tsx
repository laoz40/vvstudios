import type { ReactNode } from "react";
import {
	AdminSearchFieldPopover,
	type AdminSearchFieldPopoverExtraField
} from "#studio/features/admin/components/AdminSearchFieldPopover";
import { useAdminPrivacyMode } from "#studio/features/admin/components/AdminPrivacyMode";

type PrivacySensitiveTextProps = {
	additionalPopoverFields?: AdminSearchFieldPopoverExtraField[];
	children: ReactNode;
	className?: string;
	copyable?: boolean;
	label: string;
	onSearch?: (searchQuery: string) => void;
	rowId: string;
	searchPrefix?: string;
	value: string;
};

export function PrivacySensitiveText({
	additionalPopoverFields,
	children,
	className,
	copyable = true,
	label,
	onSearch,
	rowId,
	searchPrefix,
	value
}: PrivacySensitiveTextProps) {
	const { isPrivacyModeEnabled, isRowRevealed, toggleRowPrivacy } = useAdminPrivacyMode();
	const isBlurred = isPrivacyModeEnabled && !isRowRevealed(rowId);

	const canOpenFieldActions =
		copyable && onSearch !== undefined && searchPrefix !== undefined && searchPrefix.length > 0;

	if (!isPrivacyModeEnabled) {
		if (!canOpenFieldActions) {
			return <span>{children}</span>;
		}

		return (
			<AdminSearchFieldPopover
				additionalFields={additionalPopoverFields}
				className={className}
				fieldLabel={label}
				onSearch={onSearch}
				searchPrefix={searchPrefix}
				value={value}>
				{children}
			</AdminSearchFieldPopover>
		);
	}

	if (isBlurred) {
		return (
			<button
				type="button"
				className="cursor-pointer text-left"
				onClick={() => toggleRowPrivacy(rowId)}
				aria-label={`Reveal ${label}`}>
				<span className="inline-block blur-sm select-none">{children}</span>
			</button>
		);
	}

	if (!canOpenFieldActions) {
		return (
			<button
				type="button"
				className="cursor-pointer text-left select-text"
				onClick={() => toggleRowPrivacy(rowId)}
				aria-label={`Hide ${label}`}>
				{children}
			</button>
		);
	}

	return (
		<AdminSearchFieldPopover
			additionalFields={additionalPopoverFields}
			className={className}
			fieldLabel={label}
			onSearch={onSearch}
			searchPrefix={searchPrefix}
			value={value}>
			{children}
		</AdminSearchFieldPopover>
	);
}
