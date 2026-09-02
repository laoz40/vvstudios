import type { Id } from "#convex/_generated/dataModel";
import { parseRemainingBalanceAmountDraft } from "#studio/features/admin/lib/remaining-balance";
import { formatEditingAddonList } from "#studio/features/booking-form/lib/editing-addon-quantities";
import type {
	BookingAddonQuantities,
	BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import { DURATION_PRICES } from "#studio/features/booking-form/lib/booking-pricing";
import { BOOKING_DEPOSIT_AMOUNT } from "#studio/features/booking-invoice/lib/constants";
import { getAddonAmount } from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import type { BookingDuration, BookingService } from "#studio/features/booking-invoice/lib/types";

export type CustomInvoiceDraft = {
	service: BookingService | "";
	duration: BookingFormValues["duration"] | "";
	addons: BookingFormValues["addons"];
} & BookingAddonQuantities & {
		dueDate: string;
		includeDepositLineItem: boolean;
		customTotalDueAmount: string;
	};

type CustomInvoiceGenerationData =
	| { status: "invalidTotal" }
	| {
			status: "ready";
			createInput: {
				bookingId: Id<"bookings">;
				dueDate: string;
				service?: BookingService;
				duration?: BookingFormValues["duration"];
				addons: BookingFormValues["addons"];
			} & BookingAddonQuantities & {
					includeDepositLineItem: boolean;
					customTotalDueAmount?: number;
				};
			downloadInput: {
				service: BookingService | null;
				duration?: BookingFormValues["duration"];
				addons: BookingFormValues["addons"];
			} & BookingAddonQuantities & {
					dueDate: string;
					includeDepositLineItem: boolean;
					customTotalDueAmount?: number;
				};
	  };

export function buildCustomInvoiceGenerationData(
	bookingId: Id<"bookings">,
	draft: CustomInvoiceDraft
): CustomInvoiceGenerationData {
	const customTotalResult = parseCustomInvoiceTotalDraft(draft.customTotalDueAmount);

	if (customTotalResult.status === "invalid") {
		return { status: "invalidTotal" };
	}

	const customTotalDueAmount =
		customTotalResult.status === "valid" ? customTotalResult.amount : undefined;
	const sessionSelection =
		draft.service === "" || draft.duration === ""
			? ({ status: "empty" } as const)
			: ({ status: "complete", service: draft.service, duration: draft.duration } as const);
	const selectedSessionInput =
		sessionSelection.status === "complete"
			? { service: sessionSelection.service, duration: sessionSelection.duration }
			: {};

	return {
		status: "ready",
		createInput: {
			bookingId,
			dueDate: draft.dueDate,
			...selectedSessionInput,
			addons: draft.addons,
			...pickBookingAddonQuantities(draft),
			includeDepositLineItem: draft.includeDepositLineItem,
			...(customTotalDueAmount !== undefined ? { customTotalDueAmount } : {})
		},
		downloadInput: {
			service: sessionSelection.status === "complete" ? sessionSelection.service : null,
			duration: sessionSelection.status === "complete" ? sessionSelection.duration : undefined,
			addons: draft.addons,
			...pickBookingAddonQuantities(draft),
			dueDate: draft.dueDate,
			includeDepositLineItem: draft.includeDepositLineItem,
			customTotalDueAmount
		}
	};
}

export type CustomInvoiceTotalDraftResult =
	| { status: "empty" }
	| { status: "invalid" }
	| { status: "valid"; amount: number };

export function parseCustomInvoiceTotalDraft(draft: string): CustomInvoiceTotalDraftResult {
	const trimmedDraft = draft.trim();

	if (!trimmedDraft) {
		return { status: "empty" };
	}

	const result = parseRemainingBalanceAmountDraft(trimmedDraft);

	if (result.status === "invalid") {
		return { status: "invalid" };
	}

	return { status: "valid", amount: result.amount };
}

const audCurrencyFormatter = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function formatCustomInvoiceCurrency(amount: number) {
	return audCurrencyFormatter.format(amount);
}

function isBookingDuration(value: string): value is BookingDuration {
	return value in DURATION_PRICES;
}

export function formatCustomInvoiceTotal(
	input: {
		service?: string;
		addons: readonly string[];
		duration: string;
		includeDepositLineItem: boolean;
		customTotalDueAmount?: number;
	} & BookingAddonQuantities
) {
	const serviceAmount =
		input.service && isBookingDuration(input.duration) ? DURATION_PRICES[input.duration] : 0;
	const addonsAmount = input.addons.reduce(
		(total, addon) => total + getAddonAmount(addon, input),
		0
	);
	const depositAmount = input.includeDepositLineItem ? BOOKING_DEPOSIT_AMOUNT : 0;
	const computedTotal = Math.max(serviceAmount + addonsAmount - depositAmount, 0);

	return formatCustomInvoiceCurrency(input.customTotalDueAmount ?? computedTotal);
}

export function formatCustomInvoiceAddonText(
	input: { addons: BookingFormValues["addons"] } & BookingAddonQuantities
) {
	if (input.addons.length === 0) {
		return "";
	}

	return ` · ${formatEditingAddonList(input.addons, pickBookingAddonQuantities(input))}`;
}
