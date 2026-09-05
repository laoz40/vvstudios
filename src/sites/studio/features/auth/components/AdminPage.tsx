import { useAuth } from "@clerk/clerk-react";
import { Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { studioSite } from "#/config/sites";
import { api } from "#convex/_generated/api";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { BackendAuthErrorPage } from "#studio/features/auth/components/BackendAuthErrorPage";
import { DashboardAccessGate } from "#studio/features/auth/components/DashboardAccessGate";

type EditorProvisioningState =
	| { status: "pending" }
	| { status: "complete" }
	| { status: "failed" };

export function AdminPage() {
	const { isLoaded: isClerkLoaded, userId } = useAuth();
	const { isLoading: isConvexLoading, isAuthenticated: isConvexAuthenticated } = useConvexAuth();
	const createEditorUser = useMutation(api.auth.createEditorUser);
	const [editorProvisioningState, setEditorProvisioningState] = useState<EditorProvisioningState>({
		status: "pending"
	});

	// Create or refresh the editor profile before checking dashboard access.
	useEffect(() => {
		if (!isConvexAuthenticated) return undefined;

		let isCurrent = true;
		setEditorProvisioningState({ status: "pending" });
		void createEditorUser({}).then(
			([error]) => {
				if (!isCurrent) return;
				if (error !== null) {
					setEditorProvisioningState({ status: "failed" });
					return;
				}
				setEditorProvisioningState({ status: "complete" });
			},
			() => {
				if (isCurrent) setEditorProvisioningState({ status: "failed" });
			}
		);

		return () => {
			isCurrent = false;
		};
	}, [isConvexAuthenticated, createEditorUser]);

	if (!isClerkLoaded || isConvexLoading) {
		return (
			<main className="grid min-h-dvh place-items-center px-6 py-12">
				<StudioLoadingState label="Establishing a secure uplink" />
			</main>
		);
	}

	if (!userId) {
		return <Navigate to={studioSite.routes.login} />;
	}

	if (!isConvexAuthenticated || editorProvisioningState.status === "failed") {
		return <BackendAuthErrorPage />;
	}

	if (editorProvisioningState.status === "pending") {
		return (
			<main className="grid min-h-dvh place-items-center px-6 py-12">
				<StudioLoadingState label="Preparing editor access" />
			</main>
		);
	}

	return <DashboardAccessGate />;
}
