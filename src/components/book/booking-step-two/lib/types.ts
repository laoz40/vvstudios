import type { DateValue } from "@internationalized/date";
import type {
	BookingStepTwoAddOnOption,
	BookingStepTwoContent,
	BookingStepTwoDurationOption,
} from "../../../../content/bookingTypes";
import type {
	BookingErrors,
	BookingField,
	PricingLineItem,
	SummarySection,
} from "./form-types";

export type BookingStepTwoState = {
	form: {
		selectedDate: DateValue | undefined;
		selectedDuration: string;
		selectedAddOns: string[];
		questionsOrRequests: string;
		fullName: string;
		phone: string;
		accountName: string;
		abn: string;
		email: string;
		saveBookingInfo: boolean;
	};
	hasSavedBookingData: boolean;
	isSubmitting: boolean;
	isSubmitted: boolean;
	status: string;
	statusType: "success" | "error" | "";
	errors: BookingErrors;
	submittedSummarySections: SummarySection[];
	submittedPricingItems: PricingLineItem[];
};

export type BookingStepTwoDerived = {
	dateString: string;
	formattedDateString: string;
	durationValue: string;
	selectedAddOnLabels: string[];
	submitButtonLabel: string;
	statusDialogTitle: string;
};

export type BookingStepTwoUi = {
	sectionCopy: BookingStepTwoContent["sections"];
	summaryCopy: BookingStepTwoContent["summary"];
	termsDialogCopy: BookingStepTwoContent["termsDialog"];
	durationOptions: BookingStepTwoDurationOption[];
	addOnOptions: BookingStepTwoAddOnOption[];
	contactPhone: string;
	contactEmail: string;
	pressableClass: string;
	minDate: DateValue;
};

export type BookingStepTwoActions = {
	initialize: () => void;
	handleFieldBlur: (event: FocusEvent) => void;
	toggleAddOn: (value: string, checked: boolean) => void;
	reuseLastBooking: () => Promise<void>;
	requestSubmit: () => Promise<boolean>;
	submitBooking: () => Promise<boolean>;
	clearStatusState: () => void;
	closeSummary: () => void;
	registerFieldFocus: (
		field: BookingField,
		handler: () => void,
	) => (() => void);
	registerReuseTarget: (handler: () => void) => (() => void);
};

export type BookingStepTwoStore = {
	state: BookingStepTwoState;
	derived: BookingStepTwoDerived;
	ui: BookingStepTwoUi;
	actions: BookingStepTwoActions;
};

export type BookingStepTwoContext = BookingStepTwoStore;

export type CreateBookingStoreOptions = {
	content: BookingStepTwoContent;
	pressableClass: string;
	minDate: DateValue;
};
