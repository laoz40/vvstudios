import type { ReactNode } from "react";
import { CopyableText } from "#studio/features/admin/components/AdminDashboardTableUtils";
import { useAdminPrivacyMode } from "#studio/features/admin/components/AdminPrivacyMode";

type PrivacySensitiveTextProps = {
	children: ReactNode;
	copyable?: boolean;
	label: string;
	rowId: string;
	value: string;
};

export function PrivacySensitiveText({
	children,
	copyable = true,
	label,
	rowId,
	value
}: PrivacySensitiveTextProps) {
	const { isPrivacyModeEnabled, isRowRevealed, revealRow } = useAdminPrivacyMode();
	const isBlurred = isPrivacyModeEnabled && !isRowRevealed(rowId);

	if (!isBlurred) {
		if (!copyable) {
			return <span>{children}</span>;
		}

		return (
			<CopyableText
				value={value}
				label={label}>
				{children}
			</CopyableText>
		);
	}

	return (
		<button
			type="button"
			className="cursor-pointer text-left"
			onClick={() => revealRow(rowId)}
			aria-label={`Reveal ${label}`}>
			<span className="inline-block blur-sm select-none">{children}</span>
		</button>
	);
}
