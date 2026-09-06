import type { FunctionReturnType } from "convex/server";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { tryCatch } from "#/lib/result";
import {
	recordingSpaceSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	closeBookingModal,
	useBookingModalStore
} from "#studio/features/booking-form/lib/booking-modal-store";
import {
	getSaveDefaultSpaceToastMessage,
	getSavePackageBookingToastMessage,
	getUnschedulePackageBookingToastMessage
} from "#studio/features/booking-form/lib/package-scheduling-errors";
import {
	performPackageSessionSave,
	performPackageSessionUnschedule,
	type PackageSession,
	type PackageSessionInput
} from "#studio/features/booking-form/lib/package-scheduling-session";

type PackageData = NonNullable<
	FunctionReturnType<typeof api.packageScheduling.getPackageByToken>[1]
>;

export type PackageSessionDraft = {
	activeSessionKey: string | null;
	highlightedBookingId: Id<"bookings"> | null;
	selectedDateValue: string;
	selectedNotes: string;
	selectedRemotePodcast: boolean;
	selectedService: BookingFormValues["service"];
	selectedTime: string;
};

export const emptyPackageSessionDraft = (): PackageSessionDraft => ({
	activeSessionKey: null,
	highlightedBookingId: null,
	selectedDateValue: "",
	selectedNotes: "",
	selectedRemotePodcast: false,
	selectedService: "",
	selectedTime: ""
});

export function getPackageSessionDraftForKey(
	packageData: PackageData,
	sessionKey: string,
	dateValue?: string,
	time?: string
): PackageSessionDraft {
	const booking = packageData.sessions.find((session) => session._id === sessionKey);

	return {
		activeSessionKey: sessionKey,
		highlightedBookingId: null,
		selectedDateValue: dateValue ?? "",
		selectedNotes: booking?.notes ?? "",
		selectedRemotePodcast: booking?.addons.includes("Remote Podcast") ?? false,
		selectedService:
			recordingSpaceSchema.safeParse(booking?.service ?? packageData.defaultSpace).data ?? "",
		selectedTime: time ?? ""
	};
}

type PackageScheduleMutationContext = {
	activeBooking: PackageSession | undefined;
	createPackageSession: (
		input: PackageSessionInput
	) => Promise<FunctionReturnType<typeof api.packageScheduling.createPackageSession>>;
	invalidateCalendarCache: () => void;
	noticeWindowLabel: string;
	reschedulePackageSession: (
		input: PackageSessionInput & { bookingId: Id<"bookings"> }
	) => Promise<FunctionReturnType<typeof api.packageScheduling.reschedulePackageSession>>;
	sessionDraft: PackageSessionDraft;
	setSavingSessionKey: (sessionKey: string | null) => void;
	setSessionDraft: (draft: PackageSessionDraft) => void;
	setUnschedulingBookingId: (bookingId: Id<"bookings"> | null) => void;
	token: string;
	unschedulePackageSession: (input: {
		bookingId: Id<"bookings">;
		token: string;
	}) => Promise<FunctionReturnType<typeof api.packageScheduling.unschedulePackageSession>>;
};

export async function savePackageDefaultSpace(
	selectedService: BookingFormValues["service"],
	setDefaultSpace: (input: {
		service: Exclude<BookingFormValues["service"], "">;
		token: string;
	}) => Promise<FunctionReturnType<typeof api.packageScheduling.setDefaultSpace>>,
	token: string
) {
	const service = recordingSpaceSchema.safeParse(selectedService).data;
	if (!service) {
		return;
	}

	const [saveError] = await tryCatch(setDefaultSpace({ service, token }));

	if (saveError !== null) {
		toast.error(getSaveDefaultSpaceToastMessage(saveError));
		return;
	}

	toast.success("Default recording space saved.");
}

export function requestPackageSessionSave(
	sessionDraft: PackageSessionDraft,
	saveSession: () => Promise<void>
) {
	if (sessionDraft.activeSessionKey === null) {
		toast.error("Choose a session first.");
		return;
	}

	if (
		!sessionDraft.selectedDateValue ||
		!sessionDraft.selectedTime ||
		!sessionDraft.selectedService
	) {
		toast.error("Please choose a date, time, and recording space first.");
		return;
	}

	void saveSession();
}

export async function confirmPackageSessionUnschedule(
	unschedule: (bookingId: Id<"bookings">) => Promise<void>
) {
	const confirmation = useBookingModalStore.getState();

	if (confirmation.modal !== "packageUnscheduleConfirmation") {
		return;
	}

	await unschedule(confirmation.bookingId);
}

export async function savePackageSession(context: PackageScheduleMutationContext) {
	const { sessionDraft } = context;

	if (sessionDraft.activeSessionKey === null) {
		return;
	}

	const service = recordingSpaceSchema.safeParse(sessionDraft.selectedService).data;
	if (!service) {
		return;
	}

	context.setSavingSessionKey(sessionDraft.activeSessionKey);

	const sessionInput: PackageSessionInput = {
		date: sessionDraft.selectedDateValue,
		time: sessionDraft.selectedTime,
		service,
		notes: sessionDraft.selectedNotes,
		remotePodcast: sessionDraft.selectedRemotePodcast,
		token: context.token
	};
	const saveOutcome = await performPackageSessionSave(
		context.activeBooking,
		sessionInput,
		context.createPackageSession,
		context.reschedulePackageSession
	);

	context.setSavingSessionKey(null);

	if (saveOutcome.status === "error") {
		toast.error(getSavePackageBookingToastMessage(saveOutcome.error, context.noticeWindowLabel));
		return;
	}

	closeBookingModal();
	context.setSessionDraft({
		...emptyPackageSessionDraft(),
		highlightedBookingId: saveOutcome.bookingId
	});
	toast.success(
		saveOutcome.wasReschedule
			? "Session rescheduled. Check your email for the updated invitation."
			: "Calendar event created. Check your email for the invitation."
	);
	context.invalidateCalendarCache();
}

export async function unschedulePackageSessionBooking(
	bookingId: Id<"bookings">,
	context: PackageScheduleMutationContext
) {
	context.setUnschedulingBookingId(bookingId);
	const unscheduleOutcome = await performPackageSessionUnschedule(
		bookingId,
		context.token,
		context.unschedulePackageSession
	);
	context.setUnschedulingBookingId(null);

	if (unscheduleOutcome.status === "error") {
		toast.error(
			getUnschedulePackageBookingToastMessage(unscheduleOutcome.error, context.noticeWindowLabel)
		);
		return;
	}

	closeBookingModal();
	const shouldClearDraft = context.sessionDraft.activeSessionKey === bookingId;

	context.setSessionDraft({
		...(shouldClearDraft ? emptyPackageSessionDraft() : context.sessionDraft),
		activeSessionKey: null,
		highlightedBookingId: null
	});
	context.invalidateCalendarCache();
	toast.success("Session unscheduled.");
}
