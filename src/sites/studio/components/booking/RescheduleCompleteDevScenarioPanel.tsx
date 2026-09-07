import { Link } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import { studioSite } from "#/config/sites";
import { FloatingDevMenu } from "#studio/components/booking/FloatingDevMenu";

const DEV_RESCHEDULE_COMPLETE_SCENARIO_OPTIONS = [
	{ label: "Success", value: "success" },
	{ label: "Loading", value: "loading" },
	{ label: "Booking Not Found", value: "booking_not_found" }
] as const;

export type DevRescheduleCompleteScenario =
	(typeof DEV_RESCHEDULE_COMPLETE_SCENARIO_OPTIONS)[number]["value"];

export interface RescheduleCompleteSearch {
	booking_id?: string;
	dev_scenario?: DevRescheduleCompleteScenario;
}

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

const devRescheduleCompleteScenarioSchema = z.enum(["success", "loading", "booking_not_found"]);
const nonEmptySearchStringSchema = z.string().min(1);

export function parseRescheduleCompleteSearch(
	search: Record<string, unknown>
): RescheduleCompleteSearch {
	return {
		booking_id: parseOptionalSearchString(search.booking_id),
		dev_scenario: parseDevRescheduleCompleteScenario(search.dev_scenario)
	};
}

function parseOptionalSearchString(value: unknown): string | undefined {
	const parsedValue = nonEmptySearchStringSchema.safeParse(value);
	return parsedValue.success ? parsedValue.data : undefined;
}

function parseDevRescheduleCompleteScenario(
	value: unknown
): DevRescheduleCompleteScenario | undefined {
	const parsedScenario = devRescheduleCompleteScenarioSchema.safeParse(value);
	return parsedScenario.success ? parsedScenario.data : undefined;
}
