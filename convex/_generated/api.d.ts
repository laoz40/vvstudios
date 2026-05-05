/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as bookings from "../bookings.js";
import type * as crons from "../crons.js";
import type * as env from "../env.js";
import type * as googleCalendar from "../googleCalendar.js";
import type * as http from "../http.js";
import type * as lib_bookingCalendarTime from "../lib/bookingCalendarTime.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_googleCalendarAvailability from "../lib/googleCalendarAvailability.js";
import type * as lib_googleCalendarErrors from "../lib/googleCalendarErrors.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_reminderScheduleTime from "../lib/reminderScheduleTime.js";
import type * as reminders from "../reminders.js";
import type * as stripe from "../stripe.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  bookings: typeof bookings;
  crons: typeof crons;
  env: typeof env;
  googleCalendar: typeof googleCalendar;
  http: typeof http;
  "lib/bookingCalendarTime": typeof lib_bookingCalendarTime;
  "lib/email": typeof lib_email;
  "lib/googleCalendarAvailability": typeof lib_googleCalendarAvailability;
  "lib/googleCalendarErrors": typeof lib_googleCalendarErrors;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/reminderScheduleTime": typeof lib_reminderScheduleTime;
  reminders: typeof reminders;
  stripe: typeof stripe;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
