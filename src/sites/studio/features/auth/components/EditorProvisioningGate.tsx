import { useEffect, useState, useTransition } from "react";
import { useMutation } from "convex/react";
import { api } from "#convex/_generated/api";
import { DashboardLoadingState } from "#studio/features/auth/components/DashboardLoadingState";
import { BackendAuthErrorPage } from "#studio/features/auth/components/BackendAuthErrorPage";
import { DashboardAccessGate } from "#studio/features/auth/components/DashboardAccessGate";

type EditorProvisioningOutcome = "complete" | "failed";

export function EditorProvisioningGate() {
	const createEditorUser = useMutation(api.auth.createEditorUser);
	const [isProvisioning, startProvisioning] = useTransition();
	const [outcome, setOutcome] = useState<EditorProvisioningOutcome | null>(null);

	// Create or refresh the editor profile before checking dashboard access.
	useEffect(() => {
		let isCurrent = true;

		startProvisioning(async () => {
			const [error] = await createEditorUser({});

			if (!isCurrent) {
				return;
			}

			setOutcome(error === null ? "complete" : "failed");
		});

		return () => {
			isCurrent = false;
		};
	}, [createEditorUser, startProvisioning]);

	if (outcome === "failed") {
		return <BackendAuthErrorPage />;
	}

	if (isProvisioning || outcome === null) {
		return <DashboardLoadingState stage="preparing-editor-access" />;
	}

	return <DashboardAccessGate />;
}
