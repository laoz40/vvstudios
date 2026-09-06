import { useEffect, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import {
	recordingSpaceSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import type { PackageSession } from "#studio/features/booking-form/lib/package-scheduling-session";

type PackageData = NonNullable<
	FunctionReturnType<typeof api.packageScheduling.getPackageByToken>[1]
>;

interface UsePackageSessionDraftOptions {
	packageData: PackageData;
}

export function usePackageSessionDraft({ packageData }: UsePackageSessionDraftOptions) {
	const [activeSessionKey, setActiveSessionKey] = useState<string | null>(null);
	const [selectedDateValue, setSelectedDateValue] = useState("");
	const [selectedNotes, setSelectedNotes] = useState("");
	const [selectedRemotePodcast, setSelectedRemotePodcast] = useState(false);
	const [selectedService, setSelectedService] = useState<BookingFormValues["service"]>("");
	const [selectedTime, setSelectedTime] = useState("");
	const [highlightedBookingId, setHighlightedBookingId] = useState<Id<"bookings"> | null>(null);

	const activeBooking: PackageSession | undefined = packageData.sessions.find(
		(booking) => booking._id === activeSessionKey
	);

	// Fade the updated session border back after the success highlight.
	useEffect(() => {
		if (highlightedBookingId === null) {
			return undefined;
		}

		const timeout = window.setTimeout(() => {
			setHighlightedBookingId(null);
		}, 1_000);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [highlightedBookingId]);

	function handleChooseSession(sessionKey: string, dateValue?: string, time?: string) {
		const booking = packageData.sessions.find((session) => session._id === sessionKey);
		setActiveSessionKey(sessionKey);
		setSelectedDateValue(dateValue ?? "");
		setSelectedNotes(booking?.notes ?? "");
		setSelectedRemotePodcast(booking?.addons.includes("Remote Podcast") ?? false);
		setSelectedService(
			recordingSpaceSchema.safeParse(booking?.service ?? packageData.defaultSpace).data ?? ""
		);
		setSelectedTime(time ?? "");
	}

	function handleCloseSession() {
		setActiveSessionKey(null);
	}

	function handleDateChange(dateValue: string) {
		setSelectedDateValue(dateValue);
		setSelectedTime("");
	}

	function handleRemotePodcastChange(checked: boolean) {
		setSelectedRemotePodcast(checked);
	}

	function clearSessionDraft() {
		setSelectedDateValue("");
		setSelectedNotes("");
		setSelectedRemotePodcast(false);
		setSelectedService("");
		setSelectedTime("");
	}

	return {
		activeBooking,
		activeSessionKey,
		clearSessionDraft,
		handleChooseSession,
		handleCloseSession,
		handleDateChange,
		handleRemotePodcastChange,
		highlightedBookingId,
		selectedDateValue,
		selectedNotes,
		selectedRemotePodcast,
		selectedService,
		selectedTime,
		setActiveSessionKey,
		setHighlightedBookingId,
		setSelectedNotes,
		setSelectedService,
		setSelectedTime
	};
}
