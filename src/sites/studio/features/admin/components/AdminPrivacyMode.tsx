import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
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
	const [isPrivacyModeEnabled, setIsPrivacyModeEnabled] = useState(readStoredPrivacyMode);
	const [revealedRowIds, setRevealedRowIds] = useState<ReadonlySet<string>>(() => new Set());

	const setPrivacyModeEnabled = useCallback((enabled: boolean) => {
		setIsPrivacyModeEnabled(enabled);
		storePrivacyMode(enabled);

		if (!enabled) {
			setRevealedRowIds(new Set());
		}
	}, []);

	const toggleRowPrivacy = useCallback((rowId: string) => {
		setRevealedRowIds((current) => {
			const next = new Set(current);

			if (next.has(rowId)) {
				next.delete(rowId);
			} else {
				next.add(rowId);
			}

			return next;
		});
	}, []);

	const isRowRevealed = useCallback((rowId: string) => revealedRowIds.has(rowId), [revealedRowIds]);

	const value = useMemo(
		() => ({ isPrivacyModeEnabled, isRowRevealed, setPrivacyModeEnabled, toggleRowPrivacy }),
		[isPrivacyModeEnabled, isRowRevealed, setPrivacyModeEnabled, toggleRowPrivacy]
	);

	return (
		<AdminPrivacyModeContext.Provider value={value}>{children}</AdminPrivacyModeContext.Provider>
	);
}

export function useAdminPrivacyMode() {
	const context = useContext(AdminPrivacyModeContext);

	if (!context) {
		throw new Error("useAdminPrivacyMode must be used within AdminPrivacyModeProvider.");
	}

	return context;
}
