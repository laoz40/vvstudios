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
import type * as bookingSettings from "../bookingSettings.js";
import type * as crons from "../crons.js";
import type * as customInvoices from "../customInvoices.js";
import type * as deliverablesEmail from "../deliverablesEmail.js";
import type * as env from "../env.js";
import type * as feedback from "../feedback.js";
import type * as googleCalendar from "../googleCalendar.js";
import type * as http from "../http.js";
import type * as invoices from "../invoices.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_bookingInvoiceArtifacts from "../lib/bookingInvoiceArtifacts.js";
import type * as lib_bookingSettings from "../lib/bookingSettings.js";
import type * as lib_bookingSubmission from "../lib/bookingSubmission.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_googleCalendarAvailability from "../lib/googleCalendarAvailability.js";
import type * as lib_googleCalendarClient from "../lib/googleCalendarClient.js";
import type * as lib_googleCalendarErrors from "../lib/googleCalendarErrors.js";
import type * as lib_googleDriveLinks from "../lib/googleDriveLinks.js";
import type * as lib_packageAdjustments from "../lib/packageAdjustments.js";
import type * as lib_packageScheduleEmail from "../lib/packageScheduleEmail.js";
import type * as lib_packageScheduling from "../lib/packageScheduling.js";
import type * as lib_packageSchedulingCalendar from "../lib/packageSchedulingCalendar.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_reminderScheduleTime from "../lib/reminderScheduleTime.js";
import type * as lib_sessionAdminEdit from "../lib/sessionAdminEdit.js";
import type * as lib_sessionCalendarEvents from "../lib/sessionCalendarEvents.js";
import type * as lib_sessionCalendarTime from "../lib/sessionCalendarTime.js";
import type * as lib_sessionCompletion from "../lib/sessionCompletion.js";
import type * as lib_sessionLookup from "../lib/sessionLookup.js";
import type * as lib_sessionRescheduleLinks from "../lib/sessionRescheduleLinks.js";
import type * as lib_sessionReservations from "../lib/sessionReservations.js";
import type * as multiBookings from "../multiBookings.js";
import type * as packageAdjustmentInvoices from "../packageAdjustmentInvoices.js";
import type * as packageAdjustments from "../packageAdjustments.js";
import type * as packageScheduling from "../packageScheduling.js";
import type * as packageSchedulingCalendar from "../packageSchedulingCalendar.js";
import type * as packages from "../packages.js";
import type * as reminders from "../reminders.js";
import type * as sessionCheckout from "../sessionCheckout.js";
import type * as sessionCompletion from "../sessionCompletion.js";
import type * as sessionReminders from "../sessionReminders.js";
import type * as sessionReschedule from "../sessionReschedule.js";
import type * as sessionScheduling from "../sessionScheduling.js";
import type * as sessions from "../sessions.js";
import type * as stripe from "../stripe.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bookingSettings: typeof bookingSettings;
  crons: typeof crons;
  customInvoices: typeof customInvoices;
  deliverablesEmail: typeof deliverablesEmail;
  env: typeof env;
  feedback: typeof feedback;
  googleCalendar: typeof googleCalendar;
  http: typeof http;
  invoices: typeof invoices;
  "lib/auth": typeof lib_auth;
  "lib/bookingInvoiceArtifacts": typeof lib_bookingInvoiceArtifacts;
  "lib/bookingSettings": typeof lib_bookingSettings;
  "lib/bookingSubmission": typeof lib_bookingSubmission;
  "lib/email": typeof lib_email;
  "lib/googleCalendarAvailability": typeof lib_googleCalendarAvailability;
  "lib/googleCalendarClient": typeof lib_googleCalendarClient;
  "lib/googleCalendarErrors": typeof lib_googleCalendarErrors;
  "lib/googleDriveLinks": typeof lib_googleDriveLinks;
  "lib/packageAdjustments": typeof lib_packageAdjustments;
  "lib/packageScheduleEmail": typeof lib_packageScheduleEmail;
  "lib/packageScheduling": typeof lib_packageScheduling;
  "lib/packageSchedulingCalendar": typeof lib_packageSchedulingCalendar;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/reminderScheduleTime": typeof lib_reminderScheduleTime;
  "lib/sessionAdminEdit": typeof lib_sessionAdminEdit;
  "lib/sessionCalendarEvents": typeof lib_sessionCalendarEvents;
  "lib/sessionCalendarTime": typeof lib_sessionCalendarTime;
  "lib/sessionCompletion": typeof lib_sessionCompletion;
  "lib/sessionLookup": typeof lib_sessionLookup;
  "lib/sessionRescheduleLinks": typeof lib_sessionRescheduleLinks;
  "lib/sessionReservations": typeof lib_sessionReservations;
  multiBookings: typeof multiBookings;
  packageAdjustmentInvoices: typeof packageAdjustmentInvoices;
  packageAdjustments: typeof packageAdjustments;
  packageScheduling: typeof packageScheduling;
  packageSchedulingCalendar: typeof packageSchedulingCalendar;
  packages: typeof packages;
  reminders: typeof reminders;
  sessionCheckout: typeof sessionCheckout;
  sessionCompletion: typeof sessionCompletion;
  sessionReminders: typeof sessionReminders;
  sessionReschedule: typeof sessionReschedule;
  sessionScheduling: typeof sessionScheduling;
  sessions: typeof sessions;
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
