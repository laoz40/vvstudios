import type {
	BookingPageContent,
	BookingStepOneContent,
	BookingStepTwoContent,
} from "./bookingTypes";

// Environment variables
const tableBookingUrl1 = import.meta.env.PUBLIC_BOOKING_TABLE_1_URL;
const tableBookingUrl2 = import.meta.env.PUBLIC_BOOKING_TABLE_2_URL;
const tableBookingUrl3 = import.meta.env.PUBLIC_BOOKING_TABLE_3_URL;
const couchBookingUrl1 = import.meta.env.PUBLIC_BOOKING_COUCH_1_URL;
const couchBookingUrl2 = import.meta.env.PUBLIC_BOOKING_COUCH_2_URL;
const couchBookingUrl3 = import.meta.env.PUBLIC_BOOKING_COUCH_3_URL;
const recurringBookingUrl = import.meta.env.PUBLIC_BOOKING_RECURRING_URL;

const scriptUrl = import.meta.env.APP_SCRIPT_URL;

const contactPhone = import.meta.env.APP_CONTACT_PHONE;
const contactEmail = import.meta.env.APP_CONTACT_EMAIL;

if (!tableBookingUrl1)
	throw new Error("Missing required env var: PUBLIC_BOOKING_TABLE_1_URL");
if (!tableBookingUrl2)
	throw new Error("Missing required env var: PUBLIC_BOOKING_TABLE_2_URL");
if (!tableBookingUrl3)
	throw new Error("Missing required env var: PUBLIC_BOOKING_TABLE_3_URL");
if (!couchBookingUrl1)
	throw new Error("Missing required env var: PUBLIC_BOOKING_COUCH_1_URL");
if (!couchBookingUrl2)
	throw new Error("Missing required env var: PUBLIC_BOOKING_COUCH_2_URL");
if (!couchBookingUrl3)
	throw new Error("Missing required env var: PUBLIC_BOOKING_COUCH_3_URL");
if (!recurringBookingUrl)
	throw new Error("Missing required env var: PUBLIC_BOOKING_RECURRING_URL");
if (!scriptUrl) throw new Error("Missing required env var: APP_SCRIPT_URL");
if (!contactPhone)
	throw new Error("Missing required env var: APP_CONTACT_PHONE");
if (!contactEmail)
	throw new Error("Missing required env var: APP_CONTACT_EMAIL");

export const bookingPageContent: BookingPageContent = {
	stepOne: {
		eyebrow: "Step 1 of 2",
		title: "Select recording space",
		lead: "Choose your space and session time",
	},
	stepTwo: {
		eyebrow: "Step 2 of 2",
		title: "Finalise Your Booking",
		lead: "Confirm your session details and choose your addons",
	},
};

export const bookingStepOneContent: BookingStepOneContent = {
	sectionLabels: {
		studioSelection: "Studio Selection",
		sessionDuration: "Session Duration",
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
			description: "A more relaxed vibe",
			imageSlot: "couch-image",
			alt: "Podcast couch setup with warm lamps and casual seating",
		},
	],
	durations: [
		{ value: "1", label: "1 Hour", price: "$200" },
		{ value: "2", label: "2 Hours", price: "$299" },
		{ value: "3", label: "3 Hours", price: "$399" },
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
	modalAriaLabel: "Close modal",
	modalCloseLabel: "Close",
	modalIframeTitle: "Choose a session",
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
	videoFormatOptions: [
		{
			value: "horizontal",
			icon: "monitor",
			label: "Horizontal / Widescreen",
			description: "Best for YouTube, TV, and websites",
		},
		{
			value: "vertical",
			icon: "smartphone",
			label: "Vertical / Tall",
			description: "Best for TikTok, Instagram Reels, and Shorts",
		},
		{
			value: "both",
			icon: "both",
			label: "Both",
			description: "When you need full episodes and social media clips",
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
			"Booking completed successfully. Check your email for your invoice.",
		submitFailed: "Booking form fail to submit.",
		submitUnexpectedlyFailed: "Submission failed unexpectedly.",
	},
	sections: {
		bookingDetailsTitle: "Booking Details",
		confirmBookingDateLabel: "CONFIRM BOOKING DATE",
		confirmSessionDurationLabel: "CONFIRM SESSION DURATION",
		reuseSavedBookingText:
			"Reuse your last saved booking information for this booking.",
		reuseSavedBookingButton: "Reuse Last Booking Info",
		sessionDetailsTitle: "Session Details",
		addOnsLegend: "ADD-ONS",
		addOnsHelper:
			"Video & Audio Package includes up to 4 RODE microphones and 3 Sony cameras.",
		videoFormatLegend: "VIDEO FORMAT",
		questionsLabel: "ANY QUESTIONS OR REQUESTS?",
		questionsPlaceholder:
			"Let us know if you have any special requests or questions.",
		questionsContactPrefix: "Available for call at",
		questionsContactMiddle: "& email at",
		contactBillingTitle: "Contact and Billing Information",
		contactInfoLabel: "CONTACT INFORMATION",
		billingInfoLabel: "BILLING INFORMATION",
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
		saveBookingInfoLabel:
			"Save booking information to this device for next time",
		selectedBadge: "SELECTED",
		submitButtonDefault: "COMPLETE BOOKING",
		submitButtonLoading: "SUBMITTING…",
	},
	summary: {
		bookingDetailsTitle: "Booking Details",
		sessionDetailsTitle: "Session Details",
		contactBillingTitle: "Contact and Billing Information",
		labels: {
			date: "Date",
			duration: "Duration",
			format: "Format",
			addOns: "Add-ons",
			questions: "Questions or Requests",
			name: "Name",
			phone: "Phone",
			account: "Account",
			abn: "ABN",
			email: "Email",
		},
		emptyValue: "—",
	},
};
