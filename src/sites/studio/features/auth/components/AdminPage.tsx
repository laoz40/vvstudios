import { useAuth } from "@clerk/clerk-react";
import { Navigate } from "@tanstack/react-router";
import { useConvexAuth } from "convex/react";
import { studioSite } from "#/config/sites";
import { DashboardLoadingState } from "#studio/features/auth/components/DashboardLoadingState";
import { BackendAuthErrorPage } from "#studio/features/auth/components/BackendAuthErrorPage";
import { EditorProvisioningGate } from "#studio/features/auth/components/EditorProvisioningGate";

export function AdminPage() {
	const { isLoaded: isClerkLoaded, userId } = useAuth();
	const { isLoading: isConvexLoading, isAuthenticated: isConvexAuthenticated } = useConvexAuth();

	if (!isClerkLoaded || isConvexLoading) {
		return <DashboardLoadingState stage="scanning-badge" />;
	}

	if (!userId) {
		return <Navigate to={studioSite.routes.login} />;
	}

	if (!isConvexAuthenticated) {
		return <BackendAuthErrorPage />;
	}

	return <EditorProvisioningGate key={userId} />;
}
