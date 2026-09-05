import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import {
	type DashboardLoadingStage,
	type DashboardRole,
	getDashboardLoadingLabel
} from "#studio/features/auth/lib/dashboard-loading-labels";

type DashboardLoadingStateProps = { dashboardRole?: DashboardRole; stage: DashboardLoadingStage };

export function DashboardLoadingState({ dashboardRole, stage }: DashboardLoadingStateProps) {
	return (
		<main className="grid min-h-dvh place-items-center px-6 py-12">
			<StudioLoadingState label={getDashboardLoadingLabel(stage, dashboardRole)} />
		</main>
	);
}
