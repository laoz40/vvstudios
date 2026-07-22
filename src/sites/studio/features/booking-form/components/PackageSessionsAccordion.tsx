import { Accordion } from "#/components/ui/accordion";
import type { Id } from "#convex/_generated/dataModel";
import type { GetPackageByTokenResult } from "#convex/packageScheduling";
import type { BookingDateTimePickerProps } from "#studio/features/booking-form/components/BookingDateTimePicker";
import { PackageSessionAccordionItem } from "#studio/features/booking-form/components/PackageSessionAccordionItem";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";

interface PackageSessionsAccordionProps {
	activeSessionKey: string | null;
	availability: BookingDateTimePickerProps["availability"];
	highlightedBookingId: Id<"bookings"> | null;
	isDefaultSpace: boolean;
	packageData: NonNullable<GetPackageByTokenResult[1]>;
	savingSessionKey: string | null;
	isSavingDefaultSpace: boolean;
	selectedDateValue: string;
	selectedNotes: string;
	selectedRemotePodcast: boolean;
	selectedService: BookingFormValues["service"];
	selectedTime: string;
	timeSelectionMessage: BookingDateTimePickerProps["timeSelectionMessage"];
	leadTimeMinutes: number;
	currentTimestamp: number;
	onDateChange: (dateValue: string) => void;
	onMakeDefaultSpace: () => void;
	onNotesChange: (notes: string) => void;
	onRemotePodcastChange: (checked: boolean) => void;
	onServiceChange: (service: Exclude<BookingFormValues["service"], "">) => void;
	onRequestUnschedule: (bookingId: Id<"bookings">, date: string) => void;
	onRequestSaveSession: () => void;
	onSessionClose: () => void;
	onSessionSelect: (sessionKey: string, dateValue?: string, time?: string) => void;
	onTimeChange: (time: string) => void;
}

export function PackageSessionsAccordion({
	activeSessionKey,
	availability,
	highlightedBookingId,
	isDefaultSpace,
	packageData,
	savingSessionKey,
	isSavingDefaultSpace,
	selectedDateValue,
	selectedNotes,
	selectedRemotePodcast,
	selectedService,
	selectedTime,
	timeSelectionMessage,
	leadTimeMinutes,
	currentTimestamp,
	onDateChange,
	onMakeDefaultSpace,
	onNotesChange,
	onRemotePodcastChange,
	onServiceChange,
	onRequestUnschedule,
	onRequestSaveSession,
	onSessionClose,
	onSessionSelect,
	onTimeChange
}: PackageSessionsAccordionProps) {
	const dateRequiredSessions = Array.from(
		{ length: packageData.packageSize - packageData.bookings.length },
		(_, index) => ({ booking: null, key: `empty-${index}`, status: "dateRequired" as const })
	);
	const scheduledSessions = packageData.bookings
		.toSorted(
			(firstBooking, secondBooking) => firstBooking.sessionStartAt - secondBooking.sessionStartAt
		)
		.map((booking) => ({
			booking,
			key: booking._id,
			status:
				booking.sessionStartAt < currentTimestamp ? ("completed" as const) : ("upcoming" as const)
		}));
	const sessions = [...scheduledSessions, ...dateRequiredSessions];
	const hasActiveSession = sessions.some((session) => session.key === activeSessionKey);
	const selection = {
		dateValue: selectedDateValue,
		notes: selectedNotes,
		remotePodcast: selectedRemotePodcast,
		service: selectedService,
		time: selectedTime
	};
	const actions = {
		onDateChange,
		onMakeDefaultSpace,
		onNotesChange,
		onRemotePodcastChange,
		onRequestSaveSession,
		onRequestUnschedule,
		onServiceChange,
		onSessionClose,
		onSessionSelect,
		onTimeChange
	};

	return (
		<Accordion
			type="single"
			collapsible
			// Keep the shared accordion default of overflow-hidden for closed panels so
			// the height animation clips cleanly. For these session panels, open content
			// needs overflow-visible so shadows on edge-aligned controls are not cut off
			// by the animated content wrapper.
			className="mt-4 grid gap-4 [&_[data-slot=accordion-content][data-state=open]]:overflow-visible"
			value={activeSessionKey ?? ""}
			onValueChange={(value) => {
				if (!value) {
					onSessionClose();
					return;
				}

				const session = sessions.find((packageSession) => packageSession.key === value);
				onSessionSelect(value, session?.booking?.date, session?.booking?.time);
			}}>
			{sessions.map((session, index) => (
				<PackageSessionAccordionItem
					key={session.key}
					actions={actions}
					activeSessionKey={activeSessionKey}
					availability={availability}
					currentTimestamp={currentTimestamp}
					duration={packageData.duration}
					hasActiveSession={hasActiveSession}
					highlightedBookingId={highlightedBookingId}
					isDefaultSpace={isDefaultSpace}
					isSavingDefaultSpace={isSavingDefaultSpace}
					leadTimeMinutes={leadTimeMinutes}
					savingSessionKey={savingSessionKey}
					selection={selection}
					session={session}
					sessionNumber={index + 1}
					timeSelectionMessage={timeSelectionMessage}
				/>
			))}
		</Accordion>
	);
}
