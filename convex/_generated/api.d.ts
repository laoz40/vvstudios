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
import type * as bookingConfirmation from "../bookingConfirmation.js";
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
import type * as lib_bookingAddonQuantities from "../lib/bookingAddonQuantities.js";
import type * as lib_bookingConfirmation from "../lib/bookingConfirmation.js";
import type * as lib_bookingInvoiceArtifacts from "../lib/bookingInvoiceArtifacts.js";
import type * as lib_bookingSettings from "../lib/bookingSettings.js";
import type * as lib_bookingSubmission from "../lib/bookingSubmission.js";
import type * as lib_customInvoices from "../lib/customInvoices.js";
import type * as lib_editorAssignments from "../lib/editorAssignments.js";
import type * as lib_editorSessions from "../lib/editorSessions.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_googleCalendarAvailability from "../lib/googleCalendarAvailability.js";
import type * as lib_googleCalendarClient from "../lib/googleCalendarClient.js";
import type * as lib_googleCalendarErrors from "../lib/googleCalendarErrors.js";
import type * as lib_googleDriveLinks from "../lib/googleDriveLinks.js";
import type * as lib_invoiceDownloads from "../lib/invoiceDownloads.js";
import type * as lib_packageAdjustments from "../lib/packageAdjustments.js";
import type * as lib_packageLookup from "../lib/packageLookup.js";
import type * as lib_packagePayment from "../lib/packagePayment.js";
import type * as lib_packageReminders from "../lib/packageReminders.js";
import type * as lib_packageScheduling from "../lib/packageScheduling.js";
import type * as lib_packageSchedulingCalendar from "../lib/packageSchedulingCalendar.js";
import type * as lib_packageUpdates from "../lib/packageUpdates.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_reminderScheduleTime from "../lib/reminderScheduleTime.js";
import type * as lib_result from "../lib/result.js";
import type * as lib_sessionAdminEdit from "../lib/sessionAdminEdit.js";
import type * as lib_sessionCalendarEvents from "../lib/sessionCalendarEvents.js";
import type * as lib_sessionCalendarTime from "../lib/sessionCalendarTime.js";
import type * as lib_sessionCheckout from "../lib/sessionCheckout.js";
import type * as lib_sessionLookup from "../lib/sessionLookup.js";
import type * as lib_sessionRescheduleLinks from "../lib/sessionRescheduleLinks.js";
import type * as lib_sessionRescheduleWorkflow from "../lib/sessionRescheduleWorkflow.js";
import type * as lib_sessionReservations from "../lib/sessionReservations.js";
import type * as packageAdjustmentInvoices from "../packageAdjustmentInvoices.js";
import type * as packageAdjustments from "../packageAdjustments.js";
import type * as packagePayment from "../packagePayment.js";
import type * as packageReminders from "../packageReminders.js";
import type * as packageScheduling from "../packageScheduling.js";
import type * as packageSchedulingCalendar from "../packageSchedulingCalendar.js";
import type * as packages from "../packages.js";
import type * as services_auth from "../services/auth.js";
import type * as services_bookingConfirmation from "../services/bookingConfirmation.js";
import type * as services_bookingConfirmationActions from "../services/bookingConfirmationActions.js";
import type * as services_bookingSettings from "../services/bookingSettings.js";
import type * as services_customInvoices from "../services/customInvoices.js";
import type * as services_deliverablesEmail from "../services/deliverablesEmail.js";
import type * as services_invoices from "../services/invoices.js";
import type * as services_packageAdjustmentInvoices from "../services/packageAdjustmentInvoices.js";
import type * as services_packageAdjustments from "../services/packageAdjustments.js";
import type * as services_packagePayment from "../services/packagePayment.js";
import type * as services_packageReminders from "../services/packageReminders.js";
import type * as services_packageScheduling from "../services/packageScheduling.js";
import type * as services_packageSchedulingCalendar from "../services/packageSchedulingCalendar.js";
import type * as services_packages from "../services/packages.js";
import type * as services_sessionCalendar from "../services/sessionCalendar.js";
import type * as services_sessionCheckout from "../services/sessionCheckout.js";
import type * as services_sessionReminders from "../services/sessionReminders.js";
import type * as services_sessionReschedule from "../services/sessionReschedule.js";
import type * as services_sessionScheduling from "../services/sessionScheduling.js";
import type * as services_sessions from "../services/sessions.js";
import type * as services_stripe from "../services/stripe.js";
import type * as sessionCheckout from "../sessionCheckout.js";
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
  bookingConfirmation: typeof bookingConfirmation;
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
  "lib/bookingAddonQuantities": typeof lib_bookingAddonQuantities;
  "lib/bookingConfirmation": typeof lib_bookingConfirmation;
  "lib/bookingInvoiceArtifacts": typeof lib_bookingInvoiceArtifacts;
  "lib/bookingSettings": typeof lib_bookingSettings;
  "lib/bookingSubmission": typeof lib_bookingSubmission;
  "lib/customInvoices": typeof lib_customInvoices;
  "lib/editorAssignments": typeof lib_editorAssignments;
  "lib/editorSessions": typeof lib_editorSessions;
  "lib/email": typeof lib_email;
  "lib/googleCalendarAvailability": typeof lib_googleCalendarAvailability;
  "lib/googleCalendarClient": typeof lib_googleCalendarClient;
  "lib/googleCalendarErrors": typeof lib_googleCalendarErrors;
  "lib/googleDriveLinks": typeof lib_googleDriveLinks;
  "lib/invoiceDownloads": typeof lib_invoiceDownloads;
  "lib/packageAdjustments": typeof lib_packageAdjustments;
  "lib/packageLookup": typeof lib_packageLookup;
  "lib/packagePayment": typeof lib_packagePayment;
  "lib/packageReminders": typeof lib_packageReminders;
  "lib/packageScheduling": typeof lib_packageScheduling;
  "lib/packageSchedulingCalendar": typeof lib_packageSchedulingCalendar;
  "lib/packageUpdates": typeof lib_packageUpdates;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/reminderScheduleTime": typeof lib_reminderScheduleTime;
  "lib/result": typeof lib_result;
  "lib/sessionAdminEdit": typeof lib_sessionAdminEdit;
  "lib/sessionCalendarEvents": typeof lib_sessionCalendarEvents;
  "lib/sessionCalendarTime": typeof lib_sessionCalendarTime;
  "lib/sessionCheckout": typeof lib_sessionCheckout;
  "lib/sessionLookup": typeof lib_sessionLookup;
  "lib/sessionRescheduleLinks": typeof lib_sessionRescheduleLinks;
  "lib/sessionRescheduleWorkflow": typeof lib_sessionRescheduleWorkflow;
  "lib/sessionReservations": typeof lib_sessionReservations;
  packageAdjustmentInvoices: typeof packageAdjustmentInvoices;
  packageAdjustments: typeof packageAdjustments;
  packagePayment: typeof packagePayment;
  packageReminders: typeof packageReminders;
  packageScheduling: typeof packageScheduling;
  packageSchedulingCalendar: typeof packageSchedulingCalendar;
  packages: typeof packages;
  "services/auth": typeof services_auth;
  "services/bookingConfirmation": typeof services_bookingConfirmation;
  "services/bookingConfirmationActions": typeof services_bookingConfirmationActions;
  "services/bookingSettings": typeof services_bookingSettings;
  "services/customInvoices": typeof services_customInvoices;
  "services/deliverablesEmail": typeof services_deliverablesEmail;
  "services/invoices": typeof services_invoices;
  "services/packageAdjustmentInvoices": typeof services_packageAdjustmentInvoices;
  "services/packageAdjustments": typeof services_packageAdjustments;
  "services/packagePayment": typeof services_packagePayment;
  "services/packageReminders": typeof services_packageReminders;
  "services/packageScheduling": typeof services_packageScheduling;
  "services/packageSchedulingCalendar": typeof services_packageSchedulingCalendar;
  "services/packages": typeof services_packages;
  "services/sessionCalendar": typeof services_sessionCalendar;
  "services/sessionCheckout": typeof services_sessionCheckout;
  "services/sessionReminders": typeof services_sessionReminders;
  "services/sessionReschedule": typeof services_sessionReschedule;
  "services/sessionScheduling": typeof services_sessionScheduling;
  "services/sessions": typeof services_sessions;
  "services/stripe": typeof services_stripe;
  sessionCheckout: typeof sessionCheckout;
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
