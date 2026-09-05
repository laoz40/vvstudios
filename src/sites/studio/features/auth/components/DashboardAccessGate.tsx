import { useQuery } from "convex/react";
import { api } from "#convex/_generated/api";
import { hasPermission } from "#/lib/permissions";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { AdminDashboard } from "#studio/features/admin/components/AdminDashboard";
import { BackendAuthErrorPage } from "#studio/features/auth/components/BackendAuthErrorPage";
import { DashboardForbiddenPage } from "#studio/features/auth/components/DashboardForbiddenPage";
import { EditorDashboardShell } from "#studio/features/editor/components/EditorDashboardShell";

export function DashboardAccessGate() {
	const accessResult = useQuery(api.auth.getCurrentUserAccess, {});

	if (!accessResult) {
		return (
			<main className="grid min-h-dvh place-items-center px-6 py-12">
				<StudioLoadingState label="Confirming Level 9 Clearance" />
			</main>
		);
	}

	const [accessError, access] = accessResult;
	if (accessError !== null) {
		switch (accessError.reason) {
			case "NOT_AUTHENTICATED":
				return <BackendAuthErrorPage />;
			case "NOT_AUTHORIZED":
				return <DashboardForbiddenPage />;
			default: {
				const _exhaustive: never = accessError;
				return _exhaustive;
			}
		}
	}

	if (!hasPermission(access.permissions, "view:sessions")) {
		return <DashboardForbiddenPage />;
	}

	if (access.role === "admin") {
		return <AdminDashboard />;
	}

	return <EditorDashboardShell />;
}
