import { z } from "zod";
import { searchOptionalField } from "#studio/lib/search-schema";

const DEV_RESCHEDULE_COMPLETE_SCENARIO_VALUES = [
	"success",
	"loading",
	"booking_not_found"
] as const;

export type DevRescheduleCompleteScenario =
	(typeof DEV_RESCHEDULE_COMPLETE_SCENARIO_VALUES)[number];

const devRescheduleCompleteScenarioSchema = z.enum(DEV_RESCHEDULE_COMPLETE_SCENARIO_VALUES);

const nonEmptySearchStringSchema = z.string().min(1);

export const rescheduleCompleteSearchSchema = z.object({
	booking_id: searchOptionalField(nonEmptySearchStringSchema),
	dev_scenario: searchOptionalField(devRescheduleCompleteScenarioSchema)
});
