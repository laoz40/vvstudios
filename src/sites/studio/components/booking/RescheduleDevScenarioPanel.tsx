import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { FloatingDevMenu } from "#studio/components/booking/FloatingDevMenu";
import type { GetRescheduleBookingByTokenResult } from "#convex/bookingReschedule";

const DEV_RESCHEDULE_SCENARIO_OPTIONS = [
	{ label: "Ready", value: "ready" },
	{ label: "Link Not Found", value: "link_not_found" },
	{ label: "Link Used", value: "link_used" },
	{ label: "Link Expired", value: "link_expired" },
	{ label: "Booking Missing", value: "booking_missing" },
	{ label: "Not Reschedulable", value: "not_reschedulable" },
	{ label: "Availability Error", value: "availability_error" },
	{ label: "Rate Limited", value: "rate_limited" },
	{ label: "No Times", value: "no_times" }
] as const;

export type DevRescheduleScenario = (typeof DEV_RESCHEDULE_SCENARIO_OPTIONS)[number]["value"];

export interface RescheduleSearch {
	dev_scenario?: DevRescheduleScenario;
}

export type RescheduleBookingLookup = NonNullable<GetRescheduleBookingByTokenResult>;

interface RescheduleDevScenarioPanelProps {
	token: string;
}

export function RescheduleDevScenarioPanel({ token }: RescheduleDevScenarioPanelProps) {
	return (
		<FloatingDevMenu
			buttonLabel="Dev States"
			title="Reschedule States">
			{(closeMenu) =>
				DEV_RESCHEDULE_SCENARIO_OPTIONS.map((scenario) => (
					<Button
						asChild
						key={scenario.value}
						size="sm"
						variant="ghost"
						className="justify-start">
						<Link
							to="/reschedule/$token"
							params={{ token }}
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

export function parseRescheduleSearch(search: Record<string, unknown>): RescheduleSearch {
	return { dev_scenario: parseDevRescheduleScenario(search.dev_scenario) };
}

export function buildDevRescheduleBooking(): RescheduleBookingLookup {
	return [
		null,
		{
			booking: {
				addons: ["Essential Edit", "Clips Package"],
				date: "2026-05-12",
				duration: "2h",
				name: "Dev Customer",
				service: "Table Setup",
				time: "10:00"
			},
			expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7
		}
	];
}

export function getDevRescheduleAvailability(devScenario: DevRescheduleScenario | undefined) {
	if (devScenario === "link_not_found") {
		return { error: { reason: "RESCHEDULE_LINK_NOT_FOUND" }, times: [] } as const;
	}

	if (devScenario === "link_used") {
		return { error: { reason: "RESCHEDULE_LINK_USED" }, times: [] } as const;
	}

	if (devScenario === "link_expired") {
		return { error: { reason: "RESCHEDULE_LINK_EXPIRED" }, times: [] } as const;
	}

	if (devScenario === "booking_missing") {
		return { error: { reason: "BOOKING_NOT_FOUND" }, times: [] } as const;
	}

	if (devScenario === "not_reschedulable") {
		return { error: { reason: "BOOKING_NOT_RESCHEDULABLE" }, times: [] } as const;
	}

	if (devScenario === "availability_error") {
		return { error: { reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" }, times: [] } as const;
	}

	if (devScenario === "rate_limited") {
		return { error: { reason: "GOOGLE_CALENDAR_RATE_LIMITED" }, times: [] } as const;
	}

	if (devScenario === "no_times") {
		return { error: null, times: [] } as const;
	}

	return { error: null, times: ["09:00", "10:00", "13:00", "15:00"] } as const;
}

function parseDevRescheduleScenario(value: unknown): DevRescheduleScenario | undefined {
	return DEV_RESCHEDULE_SCENARIO_OPTIONS.some((scenario) => scenario.value === value)
		? (value as DevRescheduleScenario)
		: undefined;
}
