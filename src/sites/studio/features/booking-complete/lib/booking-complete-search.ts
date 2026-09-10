import { z } from "zod";
import { searchOptionalField } from "#studio/lib/search-schema";

const DEV_BOOKING_SCENARIO_VALUES = [
	"processing",
	"confirmed",
	"email_failed",
	"package_request",
	"expired",
	"slot_taken",
	"calendar_failed",
	"not_found"
] as const;

export type DevBookingScenario = (typeof DEV_BOOKING_SCENARIO_VALUES)[number];

export type BookingCompleteSearch = {
	dev_scenario?: DevBookingScenario;
	package_id?: string;
	package_size?: 4 | 8 | 12;
	session_id?: string;
};

const devBookingScenarioSchema = z.enum(DEV_BOOKING_SCENARIO_VALUES);

const nonEmptySearchStringSchema = z.string().min(1);

const packageSizeSchema = z.union([z.literal(4), z.literal(8), z.literal(12)]);

export const bookingCompleteSearchSchema = z.object({
	dev_scenario: searchOptionalField(devBookingScenarioSchema),
	package_id: searchOptionalField(nonEmptySearchStringSchema),
	package_size: searchOptionalField(
		z.union([packageSizeSchema, z.coerce.number().pipe(packageSizeSchema)])
	),
	session_id: searchOptionalField(nonEmptySearchStringSchema)
});
