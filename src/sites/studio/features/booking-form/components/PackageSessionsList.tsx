import type { Id } from "#convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";
import type { BookingDateTimePickerProps } from "#studio/features/booking-form/components/BookingDateTimePicker";
import { PackageSessionEditorDialog } from "#studio/features/booking-form/components/PackageSessionEditorDialog";
import { PackageSessionListItem } from "#studio/features/booking-form/components/PackageSessionListItem";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";

type PackageData = NonNullable<
	FunctionReturnType<typeof api.packageScheduling.getPackageByToken>[1]
>;

interface PackageSessionsListProps {
	activeSessionKey: string | null;
	activeBooking: PackageData["sessions"][number] | undefined;
	availability: BookingDateTimePickerProps["availability"];
	highlightedBookingId: Id<"bookings"> | null;
	isDefaultSpace: boolean;
	packageData: PackageData;
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

export function PackageSessionsList({
	activeSessionKey,
	activeBooking,
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
}: PackageSessionsListProps) {
	const dateRequiredSessions = Array.from(
		{ length: packageData.packageSize - packageData.sessions.length },
		(_, index) => ({ booking: null, key: `empty-${index}`, status: "dateRequired" as const })
	);

	const scheduledSessions = packageData.sessions
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
	const activeSessionIndex = sessions.findIndex((session) => session.key === activeSessionKey);
	const activeSessionNumber = activeSessionIndex >= 0 ? activeSessionIndex + 1 : null;

	const selection = {
		dateValue: selectedDateValue,
		notes: selectedNotes,
		remotePodcast: selectedRemotePodcast,
		service: selectedService,
		time: selectedTime
	};

	const isSelectedBookingSaved =
		activeBooking !== undefined &&
		activeBooking.date === selection.dateValue &&
		activeBooking.time === selection.time &&
		activeBooking.service === selection.service &&
		activeBooking.notes === selection.notes &&
		activeBooking.addons.includes("Remote Podcast") === selection.remotePodcast;

	const listActions = { onRequestUnschedule, onSessionClose, onSessionSelect };

	return (
		<>
			<div className="mt-4 grid gap-4">
				{sessions.map((session, index) => (
					<PackageSessionListItem
						key={session.key}
						actions={listActions}
						activeSessionKey={activeSessionKey}
						currentTimestamp={currentTimestamp}
						duration={packageData.duration}
						highlightedBookingId={highlightedBookingId}
						leadTimeMinutes={leadTimeMinutes}
						session={session}
						sessionNumber={index + 1}
					/>
				))}
			</div>
			{activeSessionKey !== null && activeSessionNumber !== null ? (
				<PackageSessionEditorDialog
					availability={availability}
					duration={packageData.duration}
					hasActiveSession
					isDefaultSpace={isDefaultSpace}
					isOpen
					isSavingDefaultSpace={isSavingDefaultSpace}
					isSelectedBookingSaved={isSelectedBookingSaved}
					onDateChange={onDateChange}
					onMakeDefaultSpace={onMakeDefaultSpace}
					onNotesChange={onNotesChange}
					onOpenChange={(open) => {
						if (!open) {
							onSessionClose();
						}
					}}
					onRemotePodcastChange={onRemotePodcastChange}
					onRequestSaveSession={onRequestSaveSession}
					onServiceChange={onServiceChange}
					onTimeChange={onTimeChange}
					preventClose={savingSessionKey !== null}
					savingSessionKey={savingSessionKey}
					selection={selection}
					sessionKey={activeSessionKey}
					sessionNumber={activeSessionNumber}
					timeSelectionMessage={timeSelectionMessage}
				/>
			) : null}
		</>
	);
}
