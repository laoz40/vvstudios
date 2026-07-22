import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";
import { FloatingDevMenu } from "#studio/components/booking/FloatingDevMenu";
import { err, ok, type Result } from "#/lib/result";
import type {
	GetRescheduleSessionByTokenResult,
	RescheduleLinkLookupError
} from "#convex/sessionReschedule";

const DEV_RESCHEDULE_SCENARIO_OPTIONS = [
	{ label: "Ready", value: "ready" },
	{ label: "Link Not Found", value: "link_not_found" },
	{ label: "Link Used", value: "link_used" },
	{ label: "Link Expired", value: "link_expired" },
	{ label: "Booking Missing", value: "booking_missing" },
	{ label: "Not Reschedulable", value: "not_reschedulable" },
	{ label: "Availability Error", value: "availability_error" },
	{ label: "Rate Limited", value: "rate_limited" },
	{ label: "No Times", value: "no_times" },
	{ label: "Update Invalid Date", value: "update_invalid_date" },
	{ label: "Update Invalid Time", value: "update_invalid_time" },
	{ label: "Update Time Unavailable", value: "update_time_unavailable" },
	{ label: "Update Calendar Error", value: "update_calendar_error" },
	{ label: "Update Rate Limited", value: "update_rate_limited" },
	{ label: "Update Unexpected", value: "update_unexpected" }
] as const;

export type DevRescheduleScenario = (typeof DEV_RESCHEDULE_SCENARIO_OPTIONS)[number]["value"];

export interface RescheduleSearch {
	dev_scenario?: DevRescheduleScenario;
}

export type RescheduleBookingLookup = NonNullable<GetRescheduleSessionByTokenResult>;

type DevRescheduleAvailabilityError =
	| RescheduleLinkLookupError
	| { reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" }
	| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" };

type DevRescheduleAvailabilityResult = Result<
	{ times: readonly string[] },
	DevRescheduleAvailabilityError
>;

export type DevRescheduleUpdateError =
	| { reason: "BOOKING_INVALID_DATE" }
	| { reason: "BOOKING_INVALID_TIME" }
	| { reason: "BOOKING_TIME_UNAVAILABLE" }
	| { reason: "GOOGLE_CALENDAR_UPDATE_FAILED" }
	| { reason: "GOOGLE_CALENDAR_RATE_LIMITED" }
	| { reason: "UNEXPECTED_ERROR" };

type DevRescheduleUpdateResult = Result<{ bookingId: string }, DevRescheduleUpdateError>;

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

export function buildDevRescheduleBooking(
	devScenario: DevRescheduleScenario | undefined
): RescheduleBookingLookup {
	if (devScenario === "link_not_found") {
		return err({ reason: "RESCHEDULE_LINK_NOT_FOUND" });
	}

	if (devScenario === "link_used") {
		return err({ reason: "RESCHEDULE_LINK_USED" });
	}

	if (devScenario === "link_expired") {
		return err({ reason: "RESCHEDULE_LINK_EXPIRED" });
	}

	if (devScenario === "booking_missing") {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	if (devScenario === "not_reschedulable") {
		return err({ reason: "BOOKING_NOT_RESCHEDULABLE" });
	}

	return ok({
		session: {
			addons: ["Essential Edit", "Clips Package"],
			date: "2026-05-12",
			duration: "2h",
			name: "Dev Customer",
			service: "Table Setup",
			time: "10:00"
		},
		expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7
	});
}

export function getDevRescheduleAvailability(
	devScenario: DevRescheduleScenario | undefined
): DevRescheduleAvailabilityResult {
	if (devScenario === "link_not_found") {
		return err({ reason: "RESCHEDULE_LINK_NOT_FOUND" });
	}

	if (devScenario === "link_used") {
		return err({ reason: "RESCHEDULE_LINK_USED" });
	}

	if (devScenario === "link_expired") {
		return err({ reason: "RESCHEDULE_LINK_EXPIRED" });
	}

	if (devScenario === "booking_missing") {
		return err({ reason: "BOOKING_NOT_FOUND" });
	}

	if (devScenario === "not_reschedulable") {
		return err({ reason: "BOOKING_NOT_RESCHEDULABLE" });
	}

	if (devScenario === "availability_error") {
		return err({ reason: "GOOGLE_CALENDAR_AVAILABILITY_FAILED" });
	}

	if (devScenario === "rate_limited") {
		return err({ reason: "GOOGLE_CALENDAR_RATE_LIMITED" });
	}

	if (devScenario === "no_times") {
		return ok({ times: [] });
	}

	return ok({ times: ["09:00", "10:00", "13:00", "15:00"] });
}

export function getDevRescheduleAvailabilityStatus(devScenario: DevRescheduleScenario | undefined) {
	const [availabilityError, availability] = getDevRescheduleAvailability(devScenario);

	if (availabilityError === null) {
		return { kind: "ready", times: [...availability.times] } as const;
	}

	switch (availabilityError.reason) {
		case "RESCHEDULE_LINK_NOT_FOUND":
		case "RESCHEDULE_LINK_USED":
		case "RESCHEDULE_LINK_EXPIRED":
		case "BOOKING_NOT_FOUND":
		case "BOOKING_NOT_RESCHEDULABLE":
			return { kind: "linkStatus" } as const;

		case "GOOGLE_CALENDAR_AVAILABILITY_FAILED":
		case "GOOGLE_CALENDAR_RATE_LIMITED":
			return { kind: "availabilityError", error: availabilityError } as const;

		default: {
			const _exhaustive: never = availabilityError;
			return _exhaustive;
		}
	}
}

export function getDevRescheduleUpdateResult(
	devScenario: DevRescheduleScenario | undefined
): DevRescheduleUpdateResult {
	if (devScenario === "update_invalid_date") {
		return err({ reason: "BOOKING_INVALID_DATE" });
	}

	if (devScenario === "update_invalid_time") {
		return err({ reason: "BOOKING_INVALID_TIME" });
	}

	if (devScenario === "update_time_unavailable") {
		return err({ reason: "BOOKING_TIME_UNAVAILABLE" });
	}

	if (devScenario === "update_calendar_error") {
		return err({ reason: "GOOGLE_CALENDAR_UPDATE_FAILED" });
	}

	if (devScenario === "update_rate_limited") {
		return err({ reason: "GOOGLE_CALENDAR_RATE_LIMITED" });
	}

	if (devScenario === "update_unexpected") {
		return err({ reason: "UNEXPECTED_ERROR" });
	}

	return ok({ bookingId: "dev-reschedule-booking" });
}

function parseDevRescheduleScenario(value: unknown): DevRescheduleScenario | undefined {
	return DEV_RESCHEDULE_SCENARIO_OPTIONS.find((scenario) => scenario.value === value)?.value;
}
