export type DashboardRole = "admin" | "editor";

export type DashboardLoadingStage =
	| "scanning-badge"
	| "confirming-clearance"
	| "preparing-editor-access"
	| "loading-data";

export function getDashboardLoadingLabel(
	stage: DashboardLoadingStage,
	dashboardRole?: DashboardRole
) {
	switch (stage) {
		case "scanning-badge":
			return "Scanning security badge";
		case "confirming-clearance":
			return "Confirming Level 9 Clearance";
		case "preparing-editor-access":
			return "Preparing your account";
		case "loading-data":
			if (dashboardRole === "admin") return "Decrypting classified files";
			return "Loading assigned sessions";
		default: {
			const _exhaustive: never = stage;
			return _exhaustive;
		}
	}
}
