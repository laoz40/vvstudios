import { z } from "zod";
import { searchOptionalField } from "#studio/lib/search-schema";

const DEV_RESCHEDULE_SCENARIO_VALUES = [
	"ready",
	"link_not_found",
	"link_used",
	"link_expired",
	"booking_missing",
	"not_reschedulable",
	"availability_error",
	"rate_limited",
	"no_times",
	"update_invalid_date",
	"update_invalid_time",
	"update_time_unavailable",
	"update_calendar_error",
	"update_rate_limited",
	"update_unexpected"
] as const;

export type DevRescheduleScenario = (typeof DEV_RESCHEDULE_SCENARIO_VALUES)[number];

export type RescheduleSearch = { dev_scenario?: DevRescheduleScenario };

const devRescheduleScenarioSchema = z.enum(DEV_RESCHEDULE_SCENARIO_VALUES);

export const rescheduleSearchSchema = z.object({
	dev_scenario: searchOptionalField(devRescheduleScenarioSchema)
});
