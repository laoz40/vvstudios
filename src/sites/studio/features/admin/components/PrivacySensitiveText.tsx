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
	const { isPrivacyModeEnabled, isRowRevealed, toggleRowPrivacy } = useAdminPrivacyMode();
	const isBlurred = isPrivacyModeEnabled && !isRowRevealed(rowId);

	if (!isPrivacyModeEnabled) {
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

	if (!copyable) {
		return (
			<button
				type="button"
				className="cursor-pointer text-left"
				onClick={() => toggleRowPrivacy(rowId)}
				aria-label={`Hide ${label}`}>
				{children}
			</button>
		);
	}

	return (
		<CopyableText
			value={value}
			label={label}
			onTextClick={() => toggleRowPrivacy(rowId)}>
			{children}
		</CopyableText>
	);
}
