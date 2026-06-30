/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as bookingReschedule from "../bookingReschedule.js";
import type * as bookingSettings from "../bookingSettings.js";
import type * as bookings from "../bookings.js";
import type * as crons from "../crons.js";
import type * as customInvoices from "../customInvoices.js";
import type * as deliverablesEmail from "../deliverablesEmail.js";
import type * as env from "../env.js";
import type * as feedback from "../feedback.js";
import type * as googleCalendar from "../googleCalendar.js";
import type * as http from "../http.js";
import type * as invoices from "../invoices.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bookingAdminEdit from "../lib/bookingAdminEdit.js";
import type * as lib_bookingCalendarTime from "../lib/bookingCalendarTime.js";
import type * as lib_bookingInvoiceArtifacts from "../lib/bookingInvoiceArtifacts.js";
import type * as lib_bookingLookup from "../lib/bookingLookup.js";
import type * as lib_bookingRescheduleLinks from "../lib/bookingRescheduleLinks.js";
import type * as lib_bookingSettings from "../lib/bookingSettings.js";
import type * as lib_bookingSubmission from "../lib/bookingSubmission.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_googleCalendarAvailability from "../lib/googleCalendarAvailability.js";
import type * as lib_googleCalendarClient from "../lib/googleCalendarClient.js";
import type * as lib_googleCalendarErrors from "../lib/googleCalendarErrors.js";
import type * as lib_googleCalendarEvents from "../lib/googleCalendarEvents.js";
import type * as lib_googleDriveLinks from "../lib/googleDriveLinks.js";
import type * as lib_multiBookingScheduleEmail from "../lib/multiBookingScheduleEmail.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_reminderScheduleTime from "../lib/reminderScheduleTime.js";
import type * as multiBookings from "../multiBookings.js";
import type * as reminders from "../reminders.js";
import type * as stripe from "../stripe.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bookingReschedule: typeof bookingReschedule;
  bookingSettings: typeof bookingSettings;
  bookings: typeof bookings;
  crons: typeof crons;
  customInvoices: typeof customInvoices;
  deliverablesEmail: typeof deliverablesEmail;
  env: typeof env;
  feedback: typeof feedback;
  googleCalendar: typeof googleCalendar;
  http: typeof http;
  invoices: typeof invoices;
  "lib/auth": typeof lib_auth;
  "lib/bookingAdminEdit": typeof lib_bookingAdminEdit;
  "lib/bookingCalendarTime": typeof lib_bookingCalendarTime;
  "lib/bookingInvoiceArtifacts": typeof lib_bookingInvoiceArtifacts;
  "lib/bookingLookup": typeof lib_bookingLookup;
  "lib/bookingRescheduleLinks": typeof lib_bookingRescheduleLinks;
  "lib/bookingSettings": typeof lib_bookingSettings;
  "lib/bookingSubmission": typeof lib_bookingSubmission;
  "lib/email": typeof lib_email;
  "lib/googleCalendarAvailability": typeof lib_googleCalendarAvailability;
  "lib/googleCalendarClient": typeof lib_googleCalendarClient;
  "lib/googleCalendarErrors": typeof lib_googleCalendarErrors;
  "lib/googleCalendarEvents": typeof lib_googleCalendarEvents;
  "lib/googleDriveLinks": typeof lib_googleDriveLinks;
  "lib/multiBookingScheduleEmail": typeof lib_multiBookingScheduleEmail;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/reminderScheduleTime": typeof lib_reminderScheduleTime;
  multiBookings: typeof multiBookings;
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
