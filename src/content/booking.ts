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
const couchBookingUrl1 = requireEnv("PUBLIC_BOOKING_COUCH_1_URL");
const couchBookingUrl2 = requireEnv("PUBLIC_BOOKING_COUCH_2_URL");
const couchBookingUrl3 = requireEnv("PUBLIC_BOOKING_COUCH_3_URL");
const recurringBookingUrl = requireEnv("PUBLIC_BOOKING_RECURRING_URL");

const scriptUrl = requireEnv("APP_SCRIPT_URL");

const contactPhone = requireEnv("APP_CONTACT_PHONE");
const contactEmail = requireEnv("APP_CONTACT_EMAIL");

export const bookingPageContent: BookingPageContent = {
	stepOne: {
		title: "STEP 1",
		lead: "Pick your space and session date. Afterwards, close the calendar and complete STEP 2 to secure booking.",
	},
	stepTwo: {
		title: "STEP 2",
		lead: "Finalise booking details and choose an add-on to enhance your session.",
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
			id: "couch",
			name: "Couch Setup",
			description: "This setup will be changing into something better!",
			imageSlot: "couch-image",
			alt: "Podcast couch setup with warm lamps and casual seating",
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
		couch: {
			"1": couchBookingUrl1,
			"2": couchBookingUrl2,
			"3": couchBookingUrl3,
		},
	},
	selectedBadge: "SELECTED",
	primaryButtonLabel: "PICK SESSION DATE",
	recurringPromptPrefix: "Need recurring sessions?",
	recurringPromptAction: "Request a call",
	recurringPromptSuffix: "to lock in your slot and secure a discounted rate.",
	modalDialogLabel: "Choose a session",
	modalCloseLabel: "Close",
	modalIframeTitle: "Choose a session",
	postBookingNotice: {
		title: "IMPORTANT",
		body: "After picking session date, complete STEP 2 below or booking will be invalid.",
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
			description: "High resolution camera capture for premium quality.",
		},
		{
			value: "teleprompter",
			icon: "scroll-text",
			label: "Teleprompter",
			price: "+$29",
			description: "On-screen script guidance for confident delivery.",
		},
		{
			value: "video-editing",
			icon: "scissors",
			label: "Video Editing",
			price: "+$99",
			description: "Synchronising audio and cutting between camera angles",
		},
		{
			value: "10-social-media-clips",
			icon: "smartphone",
			label: "10 Social Media Clips",
			price: "+$79",
			description: "With subtitles and vertical crop",
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
		addOnsHelper:
			"Video & Audio Package includes up to 4 RODE microphones and 3 Sony cameras.",
		questionsLabel: "ANYTHING ELSE?",
		questionsPlaceholder:
			"Let us know if you have any special requests or questions.",
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
		summaryDialogDescription:
			"Check your details before submitting your booking.",
		summaryDialogCancelButton: "Back",
		summaryDialogConfirmButton: "Confirm booking",
		statusDialogSuccessTitle: "Booking completed!",
		statusDialogErrorTitle: "Booking failed. Please try again.",
		statusDialogDismissButton: "Close",
		saveBookingInfoLabel:
			"Save booking information to this device for next time",
		selectedBadge: "SELECTED",
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
