import { z } from "zod";

const finiteInt = z.number().finite().int();

export const isoDateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const calendarDateFieldsSchema = z.object({
	day: finiteInt.min(1).max(31),
	month: finiteInt.min(1).max(12),
	year: finiteInt.min(1)
});

export const calendarDateSchema = isoDateStringSchema
	.transform((value) => {
		const [year, month, day] = value.split("-").map(Number);
		return { year, month, day };
	})
	.pipe(calendarDateFieldsSchema);

export type CalendarDate = z.infer<typeof calendarDateSchema>;

export const yearMonthStringSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const yearMonthSchema = yearMonthStringSchema
	.transform((value) => {
		const [year, month] = value.split("-").map(Number);
		return { year, month };
	})
	.pipe(
		z.object({
			month: finiteInt.min(1).max(12),
			year: finiteInt.min(1)
		})
	);

export type YearMonth = z.infer<typeof yearMonthSchema>;

const timeOfDayFieldsSchema = z.object({
	hours: finiteInt.min(0).max(23),
	minutes: finiteInt.min(0).max(59)
});

export const timeOfDayStringSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const timeOfDaySchema = timeOfDayStringSchema
	.transform((value) => {
		const [hours, minutes] = value.split(":").map(Number);
		return { hours, minutes };
	})
	.pipe(timeOfDayFieldsSchema);

export type TimeOfDay = z.infer<typeof timeOfDaySchema>;

export const scheduleTimeStringSchema = z.string().regex(/^([01]\d|2[0-3]):(00|30)$/);

export const scheduleTimeSchema = scheduleTimeStringSchema
	.transform((value) => {
		const [hours, minutes] = value.split(":").map(Number);
		return { hours, minutes };
	})
	.pipe(timeOfDayFieldsSchema);

export const timeZoneDateSchema = z.object({
	day: finiteInt.min(1).max(31),
	hour: finiteInt.min(0).max(24),
	month: finiteInt.min(1).max(12),
	year: finiteInt.min(1)
});

export type TimeZoneDate = z.infer<typeof timeZoneDateSchema>;

export function parseCalendarDate(value: string): CalendarDate | null {
	const result = calendarDateSchema.safeParse(value);
	return result.success ? result.data : null;
}

export function parseYearMonth(value: string): YearMonth | null {
	const result = yearMonthSchema.safeParse(value);
	return result.success ? result.data : null;
}

export function parseTimeOfDay(value: string): TimeOfDay | null {
	const result = timeOfDaySchema.safeParse(value);
	return result.success ? result.data : null;
}

export function parseScheduleTime(value: string): TimeOfDay | null {
	const result = scheduleTimeSchema.safeParse(value);
	return result.success ? result.data : null;
}

export function parseTimeZoneDate(
	values: Record<string, number | undefined>
): TimeZoneDate | null {
	const result = timeZoneDateSchema.safeParse(values);
	return result.success ? result.data : null;
}
