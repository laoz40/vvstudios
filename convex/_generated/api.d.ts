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
import type * as deliverablesReviewEmail from "../deliverablesReviewEmail.js";
import type * as devSeed from "../devSeed.js";
import type * as drive from "../drive.js";
import type * as employeeInvitations from "../employeeInvitations.js";
import type * as employees from "../employees.js";
import type * as env from "../env.js";
import type * as feedback from "../feedback.js";
import type * as googleCalendar from "../googleCalendar.js";
import type * as http from "../http.js";
import type * as internal_sessionsDrive from "../internal/sessionsDrive.js";
import type * as invoices from "../invoices.js";
import type * as lib_adminSearch_adminListSearchPage from "../lib/adminSearch/adminListSearchPage.js";
import type * as lib_adminSearch_adminSearchBlob from "../lib/adminSearch/adminSearchBlob.js";
import type * as lib_adminSearch_adminSearchDateParse from "../lib/adminSearch/adminSearchDateParse.js";
import type * as lib_adminSearch_adminSearchPrefixFilters from "../lib/adminSearch/adminSearchPrefixFilters.js";
import type * as lib_adminSearch_adminSearchQuery from "../lib/adminSearch/adminSearchQuery.js";
import type * as lib_archiveState from "../lib/archiveState.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_booking_bookingAddonQuantities from "../lib/booking/bookingAddonQuantities.js";
import type * as lib_booking_bookingConfirmation from "../lib/booking/bookingConfirmation.js";
import type * as lib_booking_bookingConfirmationClaim from "../lib/booking/bookingConfirmationClaim.js";
import type * as lib_booking_bookingDocumentEmails from "../lib/booking/bookingDocumentEmails.js";
import type * as lib_booking_bookingInvoicePdfRender from "../lib/booking/bookingInvoicePdfRender.js";
import type * as lib_booking_bookingSettings from "../lib/booking/bookingSettings.js";
import type * as lib_booking_bookingSubmission from "../lib/booking/bookingSubmission.js";
import type * as lib_clerkInvitations from "../lib/clerkInvitations.js";
import type * as lib_contactNormalization from "../lib/contactNormalization.js";
import type * as lib_drive_driveBookingDriveClient from "../lib/drive/driveBookingDriveClient.js";
import type * as lib_drive_driveClientAccess from "../lib/drive/driveClientAccess.js";
import type * as lib_drive_driveClientPermissions from "../lib/drive/driveClientPermissions.js";
import type * as lib_drive_driveEditor from "../lib/drive/driveEditor.js";
import type * as lib_drive_driveEditorPermissions from "../lib/drive/driveEditorPermissions.js";
import type * as lib_drive_driveFolders from "../lib/drive/driveFolders.js";
import type * as lib_drive_driveLookup from "../lib/drive/driveLookup.js";
import type * as lib_drive_driveScheduling from "../lib/drive/driveScheduling.js";
import type * as lib_drive_driveStatus from "../lib/drive/driveStatus.js";
import type * as lib_drive_googleDrive from "../lib/drive/googleDrive.js";
import type * as lib_drive_sessionFolders_allocateNumbers from "../lib/drive/sessionFolders/allocateNumbers.js";
import type * as lib_drive_sessionFolders_cancelCleanup from "../lib/drive/sessionFolders/cancelCleanup.js";
import type * as lib_drive_sessionFolders_clearSessionRecords from "../lib/drive/sessionFolders/clearSessionRecords.js";
import type * as lib_drive_sessionFolders_driveSetupInfo from "../lib/drive/sessionFolders/driveSetupInfo.js";
import type * as lib_drive_sessionFolders_ensureFolders from "../lib/drive/sessionFolders/ensureFolders.js";
import type * as lib_drive_sessionFolders_resolveFolderNames from "../lib/drive/sessionFolders/resolveFolderNames.js";
import type * as lib_editor_deliverablesReviewNotification from "../lib/editor/deliverablesReviewNotification.js";
import type * as lib_editor_editorAccess from "../lib/editor/editorAccess.js";
import type * as lib_editor_editorAssignments from "../lib/editor/editorAssignments.js";
import type * as lib_editor_editorSessions from "../lib/editor/editorSessions.js";
import type * as lib_email_email from "../lib/email/email.js";
import type * as lib_email_emailDomain from "../lib/email/emailDomain.js";
import type * as lib_email_emailSend from "../lib/email/emailSend.js";
import type * as lib_email_emailTemplateSenders from "../lib/email/emailTemplateSenders.js";
import type * as lib_googleCalendar_googleAuth from "../lib/googleCalendar/googleAuth.js";
import type * as lib_googleCalendar_googleCalendarAvailability from "../lib/googleCalendar/googleCalendarAvailability.js";
import type * as lib_googleCalendar_googleCalendarClient from "../lib/googleCalendar/googleCalendarClient.js";
import type * as lib_googleCalendar_googleCalendarErrors from "../lib/googleCalendar/googleCalendarErrors.js";
import type * as lib_listAdminPackages from "../lib/listAdminPackages.js";
import type * as lib_listAdminSessions from "../lib/listAdminSessions.js";
import type * as lib_packages_packageAdjustmentInvoicePayment from "../lib/packages/packageAdjustmentInvoicePayment.js";
import type * as lib_packages_packageAdjustments from "../lib/packages/packageAdjustments.js";
import type * as lib_packages_packageArchive from "../lib/packages/packageArchive.js";
import type * as lib_packages_packageCheckout from "../lib/packages/packageCheckout.js";
import type * as lib_packages_packageCheckoutClaim from "../lib/packages/packageCheckoutClaim.js";
import type * as lib_packages_packageLookup from "../lib/packages/packageLookup.js";
import type * as lib_packages_packagePayment from "../lib/packages/packagePayment.js";
import type * as lib_packages_packageReminders from "../lib/packages/packageReminders.js";
import type * as lib_packages_packageScheduling from "../lib/packages/packageScheduling.js";
import type * as lib_packages_packageSchedulingCalendar from "../lib/packages/packageSchedulingCalendar.js";
import type * as lib_packages_packageSessionCapacity from "../lib/packages/packageSessionCapacity.js";
import type * as lib_packages_packageUpdates from "../lib/packages/packageUpdates.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_reminderScheduleTime from "../lib/reminderScheduleTime.js";
import type * as lib_result from "../lib/result.js";
import type * as lib_sessions_sessionAdminEdit from "../lib/sessions/sessionAdminEdit.js";
import type * as lib_sessions_sessionAdminGoogleCalendarUpdate from "../lib/sessions/sessionAdminGoogleCalendarUpdate.js";
import type * as lib_sessions_sessionArchive from "../lib/sessions/sessionArchive.js";
import type * as lib_sessions_sessionCalendarEvents from "../lib/sessions/sessionCalendarEvents.js";
import type * as lib_sessions_sessionCalendarTime from "../lib/sessions/sessionCalendarTime.js";
import type * as lib_sessions_sessionCheckout from "../lib/sessions/sessionCheckout.js";
import type * as lib_sessions_sessionHostEmails from "../lib/sessions/sessionHostEmails.js";
import type * as lib_sessions_sessionLookup from "../lib/sessions/sessionLookup.js";
import type * as lib_sessions_sessionRescheduleLinks from "../lib/sessions/sessionRescheduleLinks.js";
import type * as lib_sessions_sessionRescheduleWorkflow from "../lib/sessions/sessionRescheduleWorkflow.js";
import type * as lib_sessions_sessionReservations from "../lib/sessions/sessionReservations.js";
import type * as lib_sessions_sessionSavePatch from "../lib/sessions/sessionSavePatch.js";
import type * as lib_sessions_sessionSchedulingArgs from "../lib/sessions/sessionSchedulingArgs.js";
import type * as lib_stripe_customInvoices from "../lib/stripe/customInvoices.js";
import type * as lib_stripe_invoiceDownloads from "../lib/stripe/invoiceDownloads.js";
import type * as lib_stripe_stripeAdjustmentInvoice from "../lib/stripe/stripeAdjustmentInvoice.js";
import type * as lib_stripe_stripeCheckoutSession from "../lib/stripe/stripeCheckoutSession.js";
import type * as lib_stripe_stripeClient from "../lib/stripe/stripeClient.js";
import type * as lib_stripe_stripeInvoice from "../lib/stripe/stripeInvoice.js";
import type * as lib_stripe_stripeInvoiceBillingUrls from "../lib/stripe/stripeInvoiceBillingUrls.js";
import type * as lib_stripe_stripeInvoices from "../lib/stripe/stripeInvoices.js";
import type * as lib_tests_testIds from "../lib/tests/testIds.js";
import type * as packageAdjustmentInvoices from "../packageAdjustmentInvoices.js";
import type * as packageAdjustments from "../packageAdjustments.js";
import type * as packageCheckout from "../packageCheckout.js";
import type * as packageCheckoutCompletionHandlers from "../packageCheckoutCompletionHandlers.js";
import type * as packagePayment from "../packagePayment.js";
import type * as packageReminders from "../packageReminders.js";
import type * as packageScheduling from "../packageScheduling.js";
import type * as packageSchedulingCalendar from "../packageSchedulingCalendar.js";
import type * as packages from "../packages.js";
import type * as receiptEmails from "../receiptEmails.js";
import type * as services_auth from "../services/auth.js";
import type * as services_booking_bookingConfirmation from "../services/booking/bookingConfirmation.js";
import type * as services_booking_bookingConfirmationActions from "../services/booking/bookingConfirmationActions.js";
import type * as services_booking_bookingSettings from "../services/booking/bookingSettings.js";
import type * as services_booking_receiptEmails from "../services/booking/receiptEmails.js";
import type * as services_booking_sessionCheckout from "../services/booking/sessionCheckout.js";
import type * as services_drive_cleanupCancelledSessionDrive from "../services/drive/cleanupCancelledSessionDrive.js";
import type * as services_drive_drive from "../services/drive/drive.js";
import type * as services_drive_driveClientPermissions from "../services/drive/driveClientPermissions.js";
import type * as services_drive_driveEditorPermissions from "../services/drive/driveEditorPermissions.js";
import type * as services_editor_deliverablesEmail from "../services/editor/deliverablesEmail.js";
import type * as services_editor_deliverablesReviewEmail from "../services/editor/deliverablesReviewEmail.js";
import type * as services_employees_employeeInvitations from "../services/employees/employeeInvitations.js";
import type * as services_googleCalendar_packageSchedulingCalendar from "../services/googleCalendar/packageSchedulingCalendar.js";
import type * as services_googleCalendar_sessionCalendar from "../services/googleCalendar/sessionCalendar.js";
import type * as services_packages_packageAdjustmentInvoicePayment from "../services/packages/packageAdjustmentInvoicePayment.js";
import type * as services_packages_packageAdjustmentInvoices from "../services/packages/packageAdjustmentInvoices.js";
import type * as services_packages_packageAdjustments from "../services/packages/packageAdjustments.js";
import type * as services_packages_packageCheckout from "../services/packages/packageCheckout.js";
import type * as services_packages_packageCheckoutActions from "../services/packages/packageCheckoutActions.js";
import type * as services_packages_packageCheckoutCompletion from "../services/packages/packageCheckoutCompletion.js";
import type * as services_packages_packageCheckoutCompletionActions from "../services/packages/packageCheckoutCompletionActions.js";
import type * as services_packages_packagePayment from "../services/packages/packagePayment.js";
import type * as services_packages_packageReminders from "../services/packages/packageReminders.js";
import type * as services_packages_packageScheduling from "../services/packages/packageScheduling.js";
import type * as services_packages_packages from "../services/packages/packages.js";
import type * as services_sessions_sessionReminders from "../services/sessions/sessionReminders.js";
import type * as services_sessions_sessionReschedule from "../services/sessions/sessionReschedule.js";
import type * as services_sessions_sessions from "../services/sessions/sessions.js";
import type * as services_stripe_customInvoices from "../services/stripe/customInvoices.js";
import type * as services_stripe_invoices from "../services/stripe/invoices.js";
import type * as services_stripe_stripe from "../services/stripe/stripe.js";
import type * as services_stripe_stripeInvoiceBillingUrls from "../services/stripe/stripeInvoiceBillingUrls.js";
import type * as services_stripe_stripeInvoicePayment from "../services/stripe/stripeInvoicePayment.js";
import type * as services_stripe_stripeInvoices from "../services/stripe/stripeInvoices.js";
import type * as services_stripe_stripeInvoicing from "../services/stripe/stripeInvoicing.js";
import type * as sessionCheckout from "../sessionCheckout.js";
import type * as sessionReminders from "../sessionReminders.js";
import type * as sessionReschedule from "../sessionReschedule.js";
import type * as sessionScheduling from "../sessionScheduling.js";
import type * as sessions from "../sessions.js";
import type * as stripe from "../stripe.js";
import type * as stripeInvoices from "../stripeInvoices.js";
import type * as stripeInvoicing from "../stripeInvoicing.js";
import type * as tests_insertDocumentDefaults from "../tests/insertDocumentDefaults.js";

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
  deliverablesReviewEmail: typeof deliverablesReviewEmail;
  devSeed: typeof devSeed;
  drive: typeof drive;
  employeeInvitations: typeof employeeInvitations;
  employees: typeof employees;
  env: typeof env;
  feedback: typeof feedback;
  googleCalendar: typeof googleCalendar;
  http: typeof http;
  "internal/sessionsDrive": typeof internal_sessionsDrive;
  invoices: typeof invoices;
  "lib/adminSearch/adminListSearchPage": typeof lib_adminSearch_adminListSearchPage;
  "lib/adminSearch/adminSearchBlob": typeof lib_adminSearch_adminSearchBlob;
  "lib/adminSearch/adminSearchDateParse": typeof lib_adminSearch_adminSearchDateParse;
  "lib/adminSearch/adminSearchPrefixFilters": typeof lib_adminSearch_adminSearchPrefixFilters;
  "lib/adminSearch/adminSearchQuery": typeof lib_adminSearch_adminSearchQuery;
  "lib/archiveState": typeof lib_archiveState;
  "lib/auth": typeof lib_auth;
  "lib/booking/bookingAddonQuantities": typeof lib_booking_bookingAddonQuantities;
  "lib/booking/bookingConfirmation": typeof lib_booking_bookingConfirmation;
  "lib/booking/bookingConfirmationClaim": typeof lib_booking_bookingConfirmationClaim;
  "lib/booking/bookingDocumentEmails": typeof lib_booking_bookingDocumentEmails;
  "lib/booking/bookingInvoicePdfRender": typeof lib_booking_bookingInvoicePdfRender;
  "lib/booking/bookingSettings": typeof lib_booking_bookingSettings;
  "lib/booking/bookingSubmission": typeof lib_booking_bookingSubmission;
  "lib/clerkInvitations": typeof lib_clerkInvitations;
  "lib/contactNormalization": typeof lib_contactNormalization;
  "lib/drive/driveBookingDriveClient": typeof lib_drive_driveBookingDriveClient;
  "lib/drive/driveClientAccess": typeof lib_drive_driveClientAccess;
  "lib/drive/driveClientPermissions": typeof lib_drive_driveClientPermissions;
  "lib/drive/driveEditor": typeof lib_drive_driveEditor;
  "lib/drive/driveEditorPermissions": typeof lib_drive_driveEditorPermissions;
  "lib/drive/driveFolders": typeof lib_drive_driveFolders;
  "lib/drive/driveLookup": typeof lib_drive_driveLookup;
  "lib/drive/driveScheduling": typeof lib_drive_driveScheduling;
  "lib/drive/driveStatus": typeof lib_drive_driveStatus;
  "lib/drive/googleDrive": typeof lib_drive_googleDrive;
  "lib/drive/sessionFolders/allocateNumbers": typeof lib_drive_sessionFolders_allocateNumbers;
  "lib/drive/sessionFolders/cancelCleanup": typeof lib_drive_sessionFolders_cancelCleanup;
  "lib/drive/sessionFolders/clearSessionRecords": typeof lib_drive_sessionFolders_clearSessionRecords;
  "lib/drive/sessionFolders/driveSetupInfo": typeof lib_drive_sessionFolders_driveSetupInfo;
  "lib/drive/sessionFolders/ensureFolders": typeof lib_drive_sessionFolders_ensureFolders;
  "lib/drive/sessionFolders/resolveFolderNames": typeof lib_drive_sessionFolders_resolveFolderNames;
  "lib/editor/deliverablesReviewNotification": typeof lib_editor_deliverablesReviewNotification;
  "lib/editor/editorAccess": typeof lib_editor_editorAccess;
  "lib/editor/editorAssignments": typeof lib_editor_editorAssignments;
  "lib/editor/editorSessions": typeof lib_editor_editorSessions;
  "lib/email/email": typeof lib_email_email;
  "lib/email/emailDomain": typeof lib_email_emailDomain;
  "lib/email/emailSend": typeof lib_email_emailSend;
  "lib/email/emailTemplateSenders": typeof lib_email_emailTemplateSenders;
  "lib/googleCalendar/googleAuth": typeof lib_googleCalendar_googleAuth;
  "lib/googleCalendar/googleCalendarAvailability": typeof lib_googleCalendar_googleCalendarAvailability;
  "lib/googleCalendar/googleCalendarClient": typeof lib_googleCalendar_googleCalendarClient;
  "lib/googleCalendar/googleCalendarErrors": typeof lib_googleCalendar_googleCalendarErrors;
  "lib/listAdminPackages": typeof lib_listAdminPackages;
  "lib/listAdminSessions": typeof lib_listAdminSessions;
  "lib/packages/packageAdjustmentInvoicePayment": typeof lib_packages_packageAdjustmentInvoicePayment;
  "lib/packages/packageAdjustments": typeof lib_packages_packageAdjustments;
  "lib/packages/packageArchive": typeof lib_packages_packageArchive;
  "lib/packages/packageCheckout": typeof lib_packages_packageCheckout;
  "lib/packages/packageCheckoutClaim": typeof lib_packages_packageCheckoutClaim;
  "lib/packages/packageLookup": typeof lib_packages_packageLookup;
  "lib/packages/packagePayment": typeof lib_packages_packagePayment;
  "lib/packages/packageReminders": typeof lib_packages_packageReminders;
  "lib/packages/packageScheduling": typeof lib_packages_packageScheduling;
  "lib/packages/packageSchedulingCalendar": typeof lib_packages_packageSchedulingCalendar;
  "lib/packages/packageSessionCapacity": typeof lib_packages_packageSessionCapacity;
  "lib/packages/packageUpdates": typeof lib_packages_packageUpdates;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/reminderScheduleTime": typeof lib_reminderScheduleTime;
  "lib/result": typeof lib_result;
  "lib/sessions/sessionAdminEdit": typeof lib_sessions_sessionAdminEdit;
  "lib/sessions/sessionAdminGoogleCalendarUpdate": typeof lib_sessions_sessionAdminGoogleCalendarUpdate;
  "lib/sessions/sessionArchive": typeof lib_sessions_sessionArchive;
  "lib/sessions/sessionCalendarEvents": typeof lib_sessions_sessionCalendarEvents;
  "lib/sessions/sessionCalendarTime": typeof lib_sessions_sessionCalendarTime;
  "lib/sessions/sessionCheckout": typeof lib_sessions_sessionCheckout;
  "lib/sessions/sessionHostEmails": typeof lib_sessions_sessionHostEmails;
  "lib/sessions/sessionLookup": typeof lib_sessions_sessionLookup;
  "lib/sessions/sessionRescheduleLinks": typeof lib_sessions_sessionRescheduleLinks;
  "lib/sessions/sessionRescheduleWorkflow": typeof lib_sessions_sessionRescheduleWorkflow;
  "lib/sessions/sessionReservations": typeof lib_sessions_sessionReservations;
  "lib/sessions/sessionSavePatch": typeof lib_sessions_sessionSavePatch;
  "lib/sessions/sessionSchedulingArgs": typeof lib_sessions_sessionSchedulingArgs;
  "lib/stripe/customInvoices": typeof lib_stripe_customInvoices;
  "lib/stripe/invoiceDownloads": typeof lib_stripe_invoiceDownloads;
  "lib/stripe/stripeAdjustmentInvoice": typeof lib_stripe_stripeAdjustmentInvoice;
  "lib/stripe/stripeCheckoutSession": typeof lib_stripe_stripeCheckoutSession;
  "lib/stripe/stripeClient": typeof lib_stripe_stripeClient;
  "lib/stripe/stripeInvoice": typeof lib_stripe_stripeInvoice;
  "lib/stripe/stripeInvoiceBillingUrls": typeof lib_stripe_stripeInvoiceBillingUrls;
  "lib/stripe/stripeInvoices": typeof lib_stripe_stripeInvoices;
  "lib/tests/testIds": typeof lib_tests_testIds;
  packageAdjustmentInvoices: typeof packageAdjustmentInvoices;
  packageAdjustments: typeof packageAdjustments;
  packageCheckout: typeof packageCheckout;
  packageCheckoutCompletionHandlers: typeof packageCheckoutCompletionHandlers;
  packagePayment: typeof packagePayment;
  packageReminders: typeof packageReminders;
  packageScheduling: typeof packageScheduling;
  packageSchedulingCalendar: typeof packageSchedulingCalendar;
  packages: typeof packages;
  receiptEmails: typeof receiptEmails;
  "services/auth": typeof services_auth;
  "services/booking/bookingConfirmation": typeof services_booking_bookingConfirmation;
  "services/booking/bookingConfirmationActions": typeof services_booking_bookingConfirmationActions;
  "services/booking/bookingSettings": typeof services_booking_bookingSettings;
  "services/booking/receiptEmails": typeof services_booking_receiptEmails;
  "services/booking/sessionCheckout": typeof services_booking_sessionCheckout;
  "services/drive/cleanupCancelledSessionDrive": typeof services_drive_cleanupCancelledSessionDrive;
  "services/drive/drive": typeof services_drive_drive;
  "services/drive/driveClientPermissions": typeof services_drive_driveClientPermissions;
  "services/drive/driveEditorPermissions": typeof services_drive_driveEditorPermissions;
  "services/editor/deliverablesEmail": typeof services_editor_deliverablesEmail;
  "services/editor/deliverablesReviewEmail": typeof services_editor_deliverablesReviewEmail;
  "services/employees/employeeInvitations": typeof services_employees_employeeInvitations;
  "services/googleCalendar/packageSchedulingCalendar": typeof services_googleCalendar_packageSchedulingCalendar;
  "services/googleCalendar/sessionCalendar": typeof services_googleCalendar_sessionCalendar;
  "services/packages/packageAdjustmentInvoicePayment": typeof services_packages_packageAdjustmentInvoicePayment;
  "services/packages/packageAdjustmentInvoices": typeof services_packages_packageAdjustmentInvoices;
  "services/packages/packageAdjustments": typeof services_packages_packageAdjustments;
  "services/packages/packageCheckout": typeof services_packages_packageCheckout;
  "services/packages/packageCheckoutActions": typeof services_packages_packageCheckoutActions;
  "services/packages/packageCheckoutCompletion": typeof services_packages_packageCheckoutCompletion;
  "services/packages/packageCheckoutCompletionActions": typeof services_packages_packageCheckoutCompletionActions;
  "services/packages/packagePayment": typeof services_packages_packagePayment;
  "services/packages/packageReminders": typeof services_packages_packageReminders;
  "services/packages/packageScheduling": typeof services_packages_packageScheduling;
  "services/packages/packages": typeof services_packages_packages;
  "services/sessions/sessionReminders": typeof services_sessions_sessionReminders;
  "services/sessions/sessionReschedule": typeof services_sessions_sessionReschedule;
  "services/sessions/sessions": typeof services_sessions_sessions;
  "services/stripe/customInvoices": typeof services_stripe_customInvoices;
  "services/stripe/invoices": typeof services_stripe_invoices;
  "services/stripe/stripe": typeof services_stripe_stripe;
  "services/stripe/stripeInvoiceBillingUrls": typeof services_stripe_stripeInvoiceBillingUrls;
  "services/stripe/stripeInvoicePayment": typeof services_stripe_stripeInvoicePayment;
  "services/stripe/stripeInvoices": typeof services_stripe_stripeInvoices;
  "services/stripe/stripeInvoicing": typeof services_stripe_stripeInvoicing;
  sessionCheckout: typeof sessionCheckout;
  sessionReminders: typeof sessionReminders;
  sessionReschedule: typeof sessionReschedule;
  sessionScheduling: typeof sessionScheduling;
  sessions: typeof sessions;
  stripe: typeof stripe;
  stripeInvoices: typeof stripeInvoices;
  stripeInvoicing: typeof stripeInvoicing;
  "tests/insertDocumentDefaults": typeof tests_insertDocumentDefaults;
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
