import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { studioSite } from "#/config/sites";
import { FloatingDevMenu } from "#studio/components/booking/FloatingDevMenu";
import type { DevRescheduleCompleteScenario } from "#studio/features/reschedule-complete/lib/reschedule-complete-search";

const DEV_RESCHEDULE_COMPLETE_SCENARIO_OPTIONS = [
	{ label: "Success", value: "success" },
	{ label: "Loading", value: "loading" },
	{ label: "Booking Not Found", value: "booking_not_found" }
] as const satisfies ReadonlyArray<{ label: string; value: DevRescheduleCompleteScenario }>;

export type { DevRescheduleCompleteScenario };

export function RescheduleCompleteDevScenarioPanel() {
	return (
		<FloatingDevMenu
			buttonLabel="Reschedule Complete States"
			title="Reschedule Complete States">
			{(closeMenu) =>
				DEV_RESCHEDULE_COMPLETE_SCENARIO_OPTIONS.map((scenario) => (
					<Button
						asChild
						key={scenario.value}
						size="sm"
						variant="ghost"
						className="justify-start">
						<Link
							to={studioSite.routes.rescheduleComplete}
							search={{ dev_scenario: scenario.value }}
							onClick={closeMenu}>
							{scenario.label}
						</Link>
					</Button>
				))
			}
		</FloatingDevMenu>
	);
}
