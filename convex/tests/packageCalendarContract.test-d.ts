/**
 * Package Calendar details keep exact quantity keys across their boundaries.
 *
 * 1. Registered actions
 *    Create and update action args retain the canonical Calendar details keys.
 *
 * 2. Package projection
 *    The unannotated package-to-Calendar projection retains those same keys.
 *
 * 3. Shared quantity metadata
 *    Form schemas and Convex validators accept every shared quantity field.
 */
import type { FunctionArgs } from "convex/server";
import type { internal } from "#convex/_generated/api";
import type { BookingAddonQuantityFieldName } from "#/domain/booking/addon-quantities";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";
import type { BookingAddonQuantitiesArgs } from "#convex/booking/lib/addonQuantities";
import type { PackageCalendarDetails } from "#convex/googleCalendar/lib/packageDetails";
import type { toPackageCalendarDetails } from "#convex/packages/lib/scheduling";

type Equal<Left, Right> = [Exclude<Left, Right>, Exclude<Right, Left>] extends [never, never]
	? true
	: false;

type Expect<Condition extends true> = Condition;

type DetailsFrom<Args> = Args extends { details: infer Details } ? Details : never;

type CreateDetails = DetailsFrom<
	FunctionArgs<typeof internal.packages.schedulingCalendar.createPackageSessionCalendarEvent>
>;

type UpdateDetails = DetailsFrom<
	FunctionArgs<typeof internal.packages.schedulingCalendar.updatePackageSessionCalendarEvent>
>;

type PackageProjectionDetails = ReturnType<typeof toPackageCalendarDetails>;

type CoversAllQuantityKeys<Value> =
	Exclude<keyof BookingAddonQuantitiesArgs, keyof Value> extends never ? true : false;

export type CreateDetailsUseCanonicalKeys = Expect<
	Equal<keyof CreateDetails, keyof PackageCalendarDetails>
>;

export type UpdateDetailsUseCanonicalKeys = Expect<
	Equal<keyof UpdateDetails, keyof PackageCalendarDetails>
>;

export type PackageProjectionUsesCanonicalKeys = Expect<
	Equal<keyof PackageProjectionDetails, keyof PackageCalendarDetails>
>;

export type CreateActionCoversEveryQuantity = Expect<CoversAllQuantityKeys<CreateDetails>>;

export type UpdateActionCoversEveryQuantity = Expect<CoversAllQuantityKeys<UpdateDetails>>;

export type PackageProjectionCoversEveryQuantity = Expect<
	CoversAllQuantityKeys<PackageProjectionDetails>
>;

export type FormAcceptsEveryQuantityField = Expect<
	Exclude<BookingAddonQuantityFieldName, keyof BookingFormValues> extends never ? true : false
>;

export type ConvexAcceptsEveryQuantityField = Expect<
	Exclude<BookingAddonQuantityFieldName, keyof BookingAddonQuantitiesArgs> extends never
		? true
		: false
>;
