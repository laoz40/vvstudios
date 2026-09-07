import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch, type UnexpectedError } from "#/lib/result";
import type { SessionEditDraft } from "#studio/features/admin/components/SessionEditDialog";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import { parseRemainingBalanceAmountDraft } from "#studio/features/admin/lib/remaining-balance";
import {
	bookingSchema,
	pickBookingAddonQuantities
} from "#studio/features/booking-form/lib/booking-form-model";

type UpdateSessionFromAdminResult = FunctionReturnType<
	typeof api.googleCalendar.updateSessionFromAdmin
>;
type SessionUpdateError = NonNullable<UpdateSessionFromAdminResult[0]> | UnexpectedError;
type ParsedSessionValues = ReturnType<typeof bookingSchema.parse>;
type RemainingBalanceResult = ReturnType<typeof parseRemainingBalanceAmountDraft> | null;

export type ParsedSessionEditDraft =
	| { status: "booking-invalid"; message: string }
	| { status: "remaining-balance-invalid" }
	| {
			status: "ok";
			parsedValues: ParsedSessionValues;
			remainingBalanceAmountResult: RemainingBalanceResult;
	  };

export type SessionEditSaveOutcome = "error" | "replacement-created" | "updated";

const sessionUpdateErrorMessageMap = {
	NOT_AUTHENTICATED: "You are not signed in.",
	NOT_AUTHORIZED: "You do not have access to update sessions.",
	BOOKING_NOT_FOUND: "That session no longer exists.",
	BOOKING_INVALID_DATE: "Enter a valid session date.",
	BOOKING_INVALID_DURATION: "Enter a valid session duration.",
	BOOKING_INVALID_TIME: "Enter a valid session time.",
	BOOKING_INVALID_INPUT: "Check the session details and balance, then try again.",
	BOOKING_TIME_UNAVAILABLE: "That time is no longer available. Choose another time.",
	GOOGLE_CALENDAR_AUTH_FAILED: "Google Calendar authentication failed. Booking was not updated.",
	GOOGLE_CALENDAR_CREATE_FAILED: "Google Calendar failed to create the event. Please try again.",
	GOOGLE_CALENDAR_UPDATE_FAILED: "Google Calendar failed to update the event. Please try again.",
	GOOGLE_CALENDAR_RATE_LIMITED: "Google Calendar is busy right now. Wait a minute, then try again.",
	GOOGLE_CALENDAR_AVAILABILITY_FAILED:
		"Something went wrong while updating the session. Please try again.",
	UNEXPECTED_ERROR: "Something went wrong while updating the session. Please try again."
} satisfies Record<SessionUpdateError["reason"], string>;

function showSessionUpdateError(error: SessionUpdateError) {
	toast.error(sessionUpdateErrorMessageMap[error.reason]);
}

export function parseSessionEditDraft(values: SessionEditDraft): ParsedSessionEditDraft {
	const parsedValues = bookingSchema.safeParse({
		name: values.name,
		phone: values.phone,
		accountName: values.accountName,
		abn: values.abn,
		email: values.email,
		bookingMode: "single",
		packageSize: "",
		date: values.date,
		time: values.time,
		duration: values.duration,
		service: values.service,
		addons: values.addons,
		...pickBookingAddonQuantities(values),
		notes: values.notes
	});

	if (!parsedValues.success) {
		return {
			status: "booking-invalid",
			message: parsedValues.error.issues[0]?.message ?? "Please check the session details."
		};
	}

	const remainingBalanceDraft = values.remainingBalanceAmount.trim();
	const remainingBalanceAmountResult = remainingBalanceDraft
		? parseRemainingBalanceAmountDraft(remainingBalanceDraft)
		: null;

	if (remainingBalanceAmountResult?.status === "invalid") {
		return { status: "remaining-balance-invalid" };
	}

	return { status: "ok", parsedValues: parsedValues.data, remainingBalanceAmountResult };
}

function buildSessionUpdateInput(
	session: SessionRecord,
	parsedValues: ParsedSessionValues,
	remainingBalanceAmountResult: RemainingBalanceResult
) {
	return {
		bookingId: session._id,
		name: parsedValues.name,
		phone: parsedValues.phone,
		accountName: parsedValues.accountName,
		...(parsedValues.abn ? { abn: parsedValues.abn } : {}),
		email: parsedValues.email,
		date: parsedValues.date,
		time: parsedValues.time,
		duration: parsedValues.duration,
		service: parsedValues.service,
		addons: parsedValues.addons,
		...pickBookingAddonQuantities(parsedValues),
		...(parsedValues.notes ? { notes: parsedValues.notes } : {}),
		...(remainingBalanceAmountResult?.status === "valid"
			? { remainingBalanceAmount: remainingBalanceAmountResult.amount }
			: {})
	};
}

export async function performSessionEditSave(
	session: SessionRecord,
	parsedDraft: Extract<ParsedSessionEditDraft, { status: "ok" }>,
	updateSession: (
		input: ReturnType<typeof buildSessionUpdateInput>
	) => Promise<UpdateSessionFromAdminResult>
): Promise<SessionEditSaveOutcome> {
	const updateInput = buildSessionUpdateInput(
		session,
		parsedDraft.parsedValues,
		parsedDraft.remainingBalanceAmountResult
	);
	const [error, result] = await tryCatch(updateSession(updateInput));

	if (error !== null) {
		showSessionUpdateError(error);
		return "error";
	}

	if (result.googleOutcome === "replacementCreated") {
		return "replacement-created";
	}

	return "updated";
}
