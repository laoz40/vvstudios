/**
 * Package Calendar details keep exact quantity keys across their boundaries.
 *
 * 1. Registered actions
 *    Create and update action args retain the canonical Calendar details keys.
 *
 * 2. Package projection
 *    The unannotated package-to-Calendar projection retains those same keys.
 */
import type { FunctionArgs } from "convex/server";
import type { internal } from "#convex/_generated/api";
import type { BookingAddonQuantitiesArgs } from "#convex/lib/booking/bookingAddonQuantities";
import type { PackageCalendarDetails } from "#convex/lib/googleCalendar/packageCalendarDetails";
import type { toPackageCalendarDetails } from "#convex/lib/packages/packageScheduling";

type Equal<Left, Right> = [Exclude<Left, Right>, Exclude<Right, Left>] extends [never, never]
	? true
	: false;

type Expect<Condition extends true> = Condition;

type DetailsFrom<Args> = Args extends { details: infer Details } ? Details : never;

type CreateDetails = DetailsFrom<
	FunctionArgs<typeof internal.packageSchedulingCalendar.createPackageSessionCalendarEvent>
>;

type UpdateDetails = DetailsFrom<
	FunctionArgs<typeof internal.packageSchedulingCalendar.updatePackageSessionCalendarEvent>
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
