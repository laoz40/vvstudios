import { createContext, use, useContext, useState, type ReactNode } from "react";
import { browser } from "react-dom";
import {
	readStoredPrivacyMode,
	storePrivacyMode
} from "#studio/features/admin/lib/admin-dashboard-preferences";

type AdminPrivacyModeContextValue = {
	isPrivacyModeEnabled: boolean;
	isRowRevealed: (rowId: string) => boolean;
	setPrivacyModeEnabled: (enabled: boolean) => void;
	toggleRowPrivacy: (rowId: string) => void;
};

const AdminPrivacyModeContext = createContext<AdminPrivacyModeContextValue | null>(null);

export function AdminPrivacyModeProvider({ children }: { children: ReactNode }) {
	use(browser());

	const [isPrivacyModeEnabled, setIsPrivacyModeEnabled] = useState(readStoredPrivacyMode);
	const [revealedRowIds, setRevealedRowIds] = useState<ReadonlySet<string>>(() => new Set());

	function setPrivacyModeEnabled(enabled: boolean) {
		setIsPrivacyModeEnabled(enabled);
		storePrivacyMode(enabled);

		if (!enabled) {
			setRevealedRowIds(new Set());
		}
	}

	function toggleRowPrivacy(rowId: string) {
		setRevealedRowIds((current) => {
			const next = new Set(current);

			if (next.has(rowId)) {
				next.delete(rowId);
			} else {
				next.add(rowId);
			}

			return next;
		});
	}

	function isRowRevealed(rowId: string) {
		return revealedRowIds.has(rowId);
	}

	const value = { isPrivacyModeEnabled, isRowRevealed, setPrivacyModeEnabled, toggleRowPrivacy };

	return <AdminPrivacyModeContext value={value}>{children}</AdminPrivacyModeContext>;
}

export function useAdminPrivacyMode() {
	const context = useContext(AdminPrivacyModeContext);

	if (!context) {
		throw new Error("useAdminPrivacyMode must be used within AdminPrivacyModeProvider.");
	}

	return context;
}
