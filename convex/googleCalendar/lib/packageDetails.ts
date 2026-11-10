import type { Infer } from "convex/values";
import type { packageCalendarDetailsValidator } from "#convex/packages/schedulingCalendar";

export type PackageCalendarDetails = Infer<typeof packageCalendarDetailsValidator>;
