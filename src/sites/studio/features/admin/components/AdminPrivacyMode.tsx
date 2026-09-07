import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
	readStoredPrivacyMode,
	storePrivacyMode
} from "#studio/features/admin/lib/admin-dashboard-preferences";

type AdminPrivacyModeContextValue = {
	isPrivacyModeEnabled: boolean;
	isRowRevealed: (rowId: string) => boolean;
	revealRow: (rowId: string) => void;
	setPrivacyModeEnabled: (enabled: boolean) => void;
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

	const revealRow = useCallback((rowId: string) => {
		setRevealedRowIds((current) => new Set([...current, rowId]));
	}, []);

	const isRowRevealed = useCallback((rowId: string) => revealedRowIds.has(rowId), [revealedRowIds]);

	const value = useMemo(
		() => ({ isPrivacyModeEnabled, isRowRevealed, revealRow, setPrivacyModeEnabled }),
		[isPrivacyModeEnabled, isRowRevealed, revealRow, setPrivacyModeEnabled]
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
