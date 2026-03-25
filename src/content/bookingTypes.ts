export type BookingPageStepContent = {
	eyebrow: string;
	title: string;
	lead: string;
};

export type BookingPageContent = {
	stepOne: BookingPageStepContent;
	stepTwo: BookingPageStepContent;
};

export type BookingUrlMap = Record<string, Record<string, string>>;

export type BookingStepOneStudioOption = {
	id: string;
	name: string;
	description: string;
	imageSlot: "table-image" | "couch-image";
	alt: string;
};

export type BookingStepOneDurationOption = {
	value: string;
	label: string;
	price: string;
};

export type BookingStepOneContent = {
	sectionLabels: {
		studioSelection: string;
		sessionDuration: string;
	};
	studios: BookingStepOneStudioOption[];
	durations: BookingStepOneDurationOption[];
	bookingUrls: BookingUrlMap;
	selectedBadge: string;
	primaryButtonLabel: string;
	recurringPromptPrefix: string;
	recurringPromptAction: string;
	recurringPromptSuffix: string;
	modalAriaLabel: string;
	modalCloseLabel: string;
	modalIframeTitle: string;
	recurringBookingUrl: string;
};

export type BookingStepTwoDurationOption = {
	value: string;
	label: string;
	description: string;
};

export type BookingStepTwoVideoFormatOption = {
	value: string;
	icon: "monitor" | "smartphone" | "both";
	label: string;
	description: string;
};

export type BookingStepTwoAddOnOption = {
	value: string;
	icon: "camera" | "scroll-text" | "scissors" | "smartphone";
	label: string;
	price: string;
	description: string;
};

export type BookingStepTwoContent = {
	durationOptions: BookingStepTwoDurationOption[];
	videoFormatOptions: BookingStepTwoVideoFormatOption[];
	addOnOptions: BookingStepTwoAddOnOption[];
	scriptUrl: string;
	contact: {
		phone: string;
		email: string;
	};
	statusMessages: {
		missingScriptUrl: string;
		success: string;
		submitFailed: string;
		submitUnexpectedlyFailed: string;
	};
	sections: {
		bookingDetailsTitle: string;
		confirmBookingDateLabel: string;
		confirmSessionDurationLabel: string;
		reuseSavedBookingText: string;
		reuseSavedBookingButton: string;
		sessionDetailsTitle: string;
		addOnsLegend: string;
		addOnsHelper: string;
		videoFormatLegend: string;
		questionsLabel: string;
		questionsPlaceholder: string;
		questionsContactPrefix: string;
		questionsContactMiddle: string;
		contactBillingTitle: string;
		contactInfoLabel: string;
		billingInfoLabel: string;
		fullNameLabel: string;
		fullNamePlaceholder: string;
		phoneLabel: string;
		phonePlaceholder: string;
		accountNameLabel: string;
		accountNamePlaceholder: string;
		abnLabel: string;
		abnPlaceholder: string;
		invoiceEmailLabel: string;
		invoiceEmailPlaceholder: string;
		summaryLabel: string;
		saveBookingInfoLabel: string;
		selectedBadge: string;
		submitButtonDefault: string;
		submitButtonLoading: string;
	};
	summary: {
		bookingDetailsTitle: string;
		sessionDetailsTitle: string;
		contactBillingTitle: string;
		labels: {
			date: string;
			duration: string;
			format: string;
			addOns: string;
			questions: string;
			name: string;
			phone: string;
			account: string;
			abn: string;
			email: string;
		};
		emptyValue: string;
	};
};
