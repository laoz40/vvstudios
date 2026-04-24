import type {
  BookingPageContent,
  BookingStepOneContent,
  BookingStepTwoContent,
} from "./bookingTypes";
import { requireEnv } from "../lib/requireEnv";

// Environment variables
const tableBookingUrl1 = requireEnv("PUBLIC_BOOKING_TABLE_1_URL");
const tableBookingUrl2 = requireEnv("PUBLIC_BOOKING_TABLE_2_URL");
const tableBookingUrl3 = requireEnv("PUBLIC_BOOKING_TABLE_3_URL");
const armchairBookingUrl1 = requireEnv("PUBLIC_BOOKING_ARMCHAIR_1_URL");
const armchairBookingUrl2 = requireEnv("PUBLIC_BOOKING_ARMCHAIR_2_URL");
const armchairBookingUrl3 = requireEnv("PUBLIC_BOOKING_ARMCHAIR_3_URL");
const recurringBookingUrl = requireEnv("PUBLIC_BOOKING_RECURRING_URL");

const scriptUrl = requireEnv("APP_SCRIPT_URL");

const contactPhone = requireEnv("APP_CONTACT_PHONE");
const contactEmail = requireEnv("APP_CONTACT_EMAIL");

export const bookingPageContent: BookingPageContent = {
  stepOne: {
    title: "Pick a space and time",
    lead: "Afterwards, you will be redirected to finalise your booking details.",
  },
  stepTwo: {
    title: "Finalise Booking",
    lead: "Confirm your details and choose an add-on to enhance your session.",
  },
};

export const bookingStepOneContent: BookingStepOneContent = {
  sectionLabels: {
    studioSelection: "SELECT RECORDING SPACE",
    sessionDuration: "SELECT SESSION DURATION",
  },
  studios: [
    {
      id: "table",
      name: "Table Setup",
      description: "For your serious discussions",
      imageSlot: "table-image",
      alt: "Podcast table setup with microphones and studio lighting",
    },
    {
      id: "armchair",
      name: "Armchair Setup",
      description: "For a more relaxed atmosphere",
      imageSlot: "armchair-image",
      alt: "Podcast armchair setup with warm lamps and casual seating",
    },
  ],
  durations: [
    {
      value: "1",
      label: "1 Hour",
      originalPrice: "$200",
      discountedPrice: "$200",
    },
    {
      value: "2",
      label: "2 Hours",
      originalPrice: "$400",
      discountedPrice: "$299",
      badgeLabel: "MOST POPULAR",
    },
    {
      value: "3",
      label: "3 Hours",
      originalPrice: "$600",
      discountedPrice: "$399",
    },
  ],
  bookingUrls: {
    table: {
      "1": tableBookingUrl1,
      "2": tableBookingUrl2,
      "3": tableBookingUrl3,
    },
    armchair: {
      "1": armchairBookingUrl1,
      "2": armchairBookingUrl2,
      "3": armchairBookingUrl3,
    },
  },
  primaryButtonLabel: "PICK SESSION DATE",
  recurringPromptPrefix: "Need recurring sessions?",
  recurringPromptAction: "Request a call",
  recurringPromptSuffix: "to lock in your slot and secure a discounted rate.",
  modalDialogLabel: "Choose a session",
  modalCloseLabel: "Close",
  modalIframeTitle: "Choose a session",
  postBookingNotice: {
    title: "WARNING",
    body: "After securing your time slot, you'll be redirected to the booking form. It MUST be completed or booking is invalid.",
    dismissLabel: "I understand",
  },
  recurringBookingUrl,
};

export const bookingStepTwoContent: BookingStepTwoContent = {
  durationOptions: [
    {
      value: "1 hr",
      label: "1 Hour",
      description: "Quick focused recording window",
    },
    {
      value: "2 hr",
      label: "2 Hours",
      description: "Balanced option for most projects",
    },
    {
      value: "3 hr",
      label: "3 Hours",
      description: "Extended time for deeper coverage",
    },
  ],
  addOnOptions: [
    {
      value: "4k-uhd-recording",
      icon: "camera",
      label: "4K UHD Recording",
      price: "+$49",
      description: "Our highest quality recording, perfect for cropping without losing clarity.",
    },
    {
      value: "video-editing",
      icon: "scissors",
      label: "Essential Edit",
      price: "+$99",
      description: "Professionally synchronised audio with clean cuts between camera angles.",
    },
    {
      value: "10-social-media-clips",
      icon: "smartphone",
      label: "Clips Package",
      price: "+$79",
      description:
        "Includes 10 clips with subtitles and vertical cropping to make them social media ready.",
    },
  ],
  scriptUrl,
  contact: {
    phone: contactPhone,
    email: contactEmail,
  },
  statusMessages: {
    missingScriptUrl: "Missing script URL.",
    success:
      "Your booking has been successfully completed. Your invoice will be sent to {email}. See you soon!",
    submitFailed: "Booking form fail to submit.",
    submitUnexpectedlyFailed: "Submission failed unexpectedly.",
  },
  termsDialog: {
    title: "Terms & Conditions",
    description: "Please review these terms before completing your booking.",
    cancelButton: "Cancel",
    confirmButton: "Agree & Complete Booking",
    items: [
      {
        title: "1 - Payment",
        body: "A non-refundable deposit is required to secure all bookings. The remaining balance must be paid before or on the day of the session. No video or audio files will be delivered until full payment is received.",
      },
      {
        title: "2 - Damage & Liability",
        body: "Clients are responsible for any damage caused to studio equipment or property during their session, excluding reasonable wear and tear. Repair or replacement costs will be charged accordingly.",
      },
      {
        title: "3 - Cancellations & Rescheduling",
        body: "Deposits are non-refundable. Bookings may be rescheduled with a minimum of 24 hours’ notice. Late cancellations or no-shows will forfeit the deposit.",
      },
      {
        title: "4 - Session Conduct & Surveillance",
        body: "Clients must arrive on time and behave respectfully. The studio is monitored by video surveillance for safety and security. The studio reserves the right to end a session without refund in cases of unsafe, illegal, or inappropriate behaviour.",
      },
      {
        title: "5 - Delivery & Revisions",
        body: "All content will be delivered after full payment has been received. Base edits include up to 3 revision rounds, limited to corrections (e.g. cuts, timing, errors). Additional revisions or creative changes will be charged separately.",
      },
    ],
  },
  sections: {
    bookingDetailsTitle: "Confirm Booking Details",
    confirmBookingDateLabel: "CONFIRM SESSION DATE",
    confirmSessionDurationLabel: "CONFIRM SESSION DURATION",
    reuseSavedBookingText: "You can reuse your last saved booking information.",
    reuseSavedBookingButton: "Reuse Last Booking Info",
    sessionDetailsTitle: "Customise Your Session",
    addOnsLegend: "SELECT ADD-ONS",
    addOnsHelper: "Each session includes three 4K Sony cameras, up to four RØDE PodMics, and cinematic overhead lighting.",
    questionsLabel: "ANYTHING ELSE?",
    questionsPlaceholder: "Let us know if you have any special requests or questions.",
    questionsContactPrefix: "Available for call at",
    questionsContactMiddle: "& email at",
    contactBillingTitle: "Contact & Billing Information",
    contactInfoLabel: "ENTER CONTACT DETAILS",
    billingInfoLabel: "ENTER BILLING INFORMATION",
    fullNameLabel: "Full Name",
    fullNamePlaceholder: "Awesome Artist",
    phoneLabel: "Contact Phone Number",
    phonePlaceholder: "0400 000 000",
    accountNameLabel: "Account Name",
    accountNamePlaceholder: "Account Name",
    abnLabel: "ABN",
    abnPlaceholder: "00 000 000 000",
    invoiceEmailLabel: "Email (to receive your invoice)",
    invoiceEmailPlaceholder: "billing@example.com",
    summaryLabel: "Summary",
    summaryDialogTitle: "Your Booking Summary",
    summaryDialogDescription: "Check your details before submitting your booking.",
    summaryDialogCancelButton: "Back",
    summaryDialogConfirmButton: "Confirm booking",
    statusDialogSuccessTitle: "Booking completed!",
    statusDialogErrorTitle: "Booking failed. Please try again.",
    statusDialogDismissButton: "Close",
    saveBookingInfoLabel: "Save booking information to this device for next time",
    submitButtonDefault: "COMPLETE BOOKING",
    submitButtonLoading: "Creating Booking…",
    submitButtonSubmitted: "SUBMITTED",
  },
  summary: {
    bookingDetailsTitle: "Booking Details",
    sessionDetailsTitle: "Session Details",
    contactBillingTitle: "Contact and Billing Information",
    paymentDueTitle: "Remaining Balance",
    paymentDueNote:
      "Note: Remaining balance must be paid in full before or on the day of your session.",
    labels: {
      date: "Date",
      duration: "Duration",
      addOns: "Add-ons",
      questions: "Questions/Requests",
      name: "Name",
      phone: "Phone",
      account: "Account",
      abn: "ABN",
      email: "Email",
      recordingSession: "Recording Session",
      bookingDeposit: "Booking Deposit",
      total: "Total",
    },
    emptyValue: "—",
  },
};
