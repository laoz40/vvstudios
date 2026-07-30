/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Interactive spans avoid invalid nested buttons inside the accordion trigger button. */
import { Armchair, EllipsisVertical, Globe, LoaderCircle } from "lucide-react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "#/components/ui/accordion";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from "#/components/ui/dropdown-menu";
import type { Id } from "#convex/_generated/dataModel";
import type { GetPackageByTokenResult } from "#convex/packageScheduling";
import {
	BookingDateTimePicker,
	type BookingDateTimePickerProps
} from "#studio/features/booking-form/components/BookingDateTimePicker";
import { BookingNotesField } from "#studio/features/booking-form/components/BookingNotesField";
import { BookingSessionSummary } from "#studio/features/booking-form/components/BookingSessionSummary";
import { PackageSessionRecordingSpaceField } from "#studio/features/booking-form/components/PackageSessionRecordingSpaceField";
import { PackageSessionRemotePodcastField } from "#studio/features/booking-form/components/PackageSessionRemotePodcastField";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";
import { isPackageSessionLocked } from "#studio/features/booking-form/lib/package-scheduling-rules";
import {
	formatBookingDateCompact,
	formatBookingDateSummaryWithoutYear,
	formatBookingTimeRange,
	formatBookingTimestampDateLong
} from "#studio/lib/bookingdatetime";
import { cn } from "#/lib/utils";

const SESSION_STATUS_DETAILS = {
	dateRequired: { label: "Date Required", textClassName: "text-destructive" },
	upcoming: { label: "Upcoming", textClassName: "text-green" },
	completed: { label: "Completed", textClassName: "text-foreground" }
} as const;

type PackageData = NonNullable<GetPackageByTokenResult[1]>;
type PackageBooking = PackageData["sessions"][number];
type PackageSession =
	| { booking: PackageBooking; key: string; status: "completed" | "upcoming" }
	| { booking: null; key: string; status: "dateRequired" };

interface PackageSessionSelection {
	dateValue: string;
	notes: string;
	remotePodcast: boolean;
	service: BookingFormValues["service"];
	time: string;
}

interface PackageSessionActionHandlers {
	onDateChange: (dateValue: string) => void;
	onMakeDefaultSpace: () => void;
	onNotesChange: (notes: string) => void;
	onRemotePodcastChange: (checked: boolean) => void;
	onRequestSaveSession: () => void;
	onRequestUnschedule: (bookingId: Id<"bookings">, date: string) => void;
	onServiceChange: (service: Exclude<BookingFormValues["service"], "">) => void;
	onSessionClose: () => void;
	onSessionSelect: (sessionKey: string, dateValue?: string, time?: string) => void;
	onTimeChange: (time: string) => void;
}

interface PackageSessionAccordionItemProps {
	actions: PackageSessionActionHandlers;
	activeSessionKey: string | null;
	availability: BookingDateTimePickerProps["availability"];
	currentTimestamp: number;
	duration: PackageData["duration"];
	hasActiveSession: boolean;
	highlightedBookingId: Id<"bookings"> | null;
	isDefaultSpace: boolean;
	isSavingDefaultSpace: boolean;
	leadTimeMinutes: number;
	savingSessionKey: string | null;
	selection: PackageSessionSelection;
	session: PackageSession;
	sessionNumber: number;
	timeSelectionMessage: BookingDateTimePickerProps["timeSelectionMessage"];
}

export function PackageSessionAccordionItem({
	actions,
	activeSessionKey,
	availability,
	currentTimestamp,
	duration,
	hasActiveSession,
	highlightedBookingId,
	isDefaultSpace,
	isSavingDefaultSpace,
	leadTimeMinutes,
	savingSessionKey,
	selection,
	session,
	sessionNumber,
	timeSelectionMessage
}: PackageSessionAccordionItemProps) {
	const booking = session.booking;
	const isSessionLocked =
		booking !== null &&
		isPackageSessionLocked(booking.sessionStartAt, leadTimeMinutes, currentTimestamp);
	const isActive = activeSessionKey === session.key;
	const canEdit = !isSessionLocked;
	const isHighlighted = highlightedBookingId === booking?._id;
	const isSelectedBookingSaved =
		booking !== null &&
		booking.date === selection.dateValue &&
		booking.time === selection.time &&
		booking.service === selection.service &&
		booking.notes === selection.notes &&
		booking.addons.includes("Remote Podcast") === selection.remotePodcast;

	return (
		<AccordionItem
			value={session.key}
			disabled={!canEdit}
			className={cn(
				"rounded-xl border bg-surface-subtle px-4 last:border-b sm:px-6",
				"text-card-foreground",
				"shadow-lg transition-colors duration-500",
				session.status === "completed" && "border-muted bg-background opacity-70 shadow-none!",
				isHighlighted && "border-primary"
			)}>
			<PackageSessionTrigger
				actions={actions}
				booking={booking}
				canEdit={canEdit}
				duration={duration}
				isActive={isActive}
				isSessionLocked={isSessionLocked}
				session={session}
				sessionNumber={sessionNumber}
			/>
			<PackageSessionEditor
				actions={actions}
				availability={availability}
				duration={duration}
				hasActiveSession={hasActiveSession}
				isDefaultSpace={isDefaultSpace}
				isSavingDefaultSpace={isSavingDefaultSpace}
				isSelectedBookingSaved={isSelectedBookingSaved}
				savingSessionKey={savingSessionKey}
				selection={selection}
				sessionKey={session.key}
				timeSelectionMessage={timeSelectionMessage}
			/>
		</AccordionItem>
	);
}

interface PackageSessionTriggerProps {
	actions: PackageSessionActionHandlers;
	booking: PackageBooking | null;
	canEdit: boolean;
	duration: PackageData["duration"];
	isActive: boolean;
	isSessionLocked: boolean;
	session: PackageSession;
	sessionNumber: number;
}

function PackageSessionTrigger({
	actions,
	booking,
	canEdit,
	duration,
	isActive,
	isSessionLocked,
	session,
	sessionNumber
}: PackageSessionTriggerProps) {
	const statusDetails = SESSION_STATUS_DETAILS[session.status];

	return (
		<AccordionTrigger
			showArrow={false}
			className={cn(
				"min-h-24 items-center py-5 hover:no-underline focus-visible:ring-0 focus-visible:ring-offset-0 md:py-6",
				!canEdit && "cursor-default hover:text-foreground"
			)}>
			<span className="flex w-full items-center justify-between gap-4 sm:gap-6">
				<span className="shrink-0 text-sm text-muted-foreground">{sessionNumber}</span>
				<span className="flex min-w-0 flex-1 flex-col items-start gap-1">
					<Badge
						variant="ghost"
						className={cn(
							"rounded-none border-0 bg-transparent p-0 tracking-wider",
							statusDetails.textClassName
						)}>
						{statusDetails.label}
					</Badge>
					<PackageSessionBookingDetails
						booking={booking}
						duration={duration}
					/>
				</span>
				<span className="ml-auto flex shrink-0 items-center justify-end gap-2">
					{session.status === "upcoming" && isSessionLocked ? (
						<span className="hidden whitespace-nowrap text-right text-xs text-muted-foreground md:inline">
							This session can no longer be edited.
						</span>
					) : null}
					{canEdit ? (
						<PackageSessionActions
							actions={actions}
							booking={booking}
							isActive={isActive}
							sessionKey={session.key}
							sessionNumber={sessionNumber}
						/>
					) : null}
				</span>
			</span>
		</AccordionTrigger>
	);
}

function PackageSessionBookingDetails({
	booking,
	duration
}: {
	booking: PackageBooking | null;
	duration: PackageData["duration"];
}) {
	if (!booking) {
		return (
			<span className="block select-text! text-left text-base text-muted-foreground transition-colors duration-500">
				<span className="md:hidden">Set your session date</span>
				<span className="hidden md:inline">Pick a date to confirm your session</span>
			</span>
		);
	}

	return (
		<span className="block select-text! text-left text-base text-muted-foreground transition-colors duration-500">
			<span className="font-semibold text-foreground">
				<span className="md:hidden">{formatBookingDateCompact(booking.date)}</span>
				<span className="hidden md:inline">
					{formatBookingTimestampDateLong(booking.sessionStartAt)}
				</span>
			</span>{" "}
			· {formatBookingTimeRange(booking.time, duration)}
			<span className="ml-2 inline-flex items-center gap-1.5 align-text-bottom text-foreground">
				<span title={booking.service}>
					{booking.service === "Table Setup" ? (
						<svg
							aria-label="Table Setup"
							className="size-4"
							viewBox="2 1 20 20"
							fill="none"
							stroke="currentColor"
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth="2">
							<path d="m4 11 4-5h8l4 5H4Z" />
							<path d="M7 11v6M17 11v6" />
						</svg>
					) : (
						<Armchair
							aria-label="Armchair Setup"
							className="size-4"
						/>
					)}
				</span>
				{booking.addons.includes("Remote Podcast") ? (
					<span title="Remote Podcast">
						<Globe
							aria-label="Remote Podcast"
							className="size-4"
						/>
					</span>
				) : null}
			</span>
		</span>
	);
}

interface PackageSessionActionsProps {
	actions: PackageSessionActionHandlers;
	booking: PackageBooking | null;
	isActive: boolean;
	sessionKey: string;
	sessionNumber: number;
}

function PackageSessionActions({
	actions,
	booking,
	isActive,
	sessionKey,
	sessionNumber
}: PackageSessionActionsProps) {
	let editButtonLabel = "SCHEDULE";

	if (booking) {
		editButtonLabel = "EDIT";
	}

	if (isActive) {
		editButtonLabel = "CLOSE";
	}

	return (
		<>
			{booking ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<span
							role="button"
							tabIndex={0}
							aria-label={`Open session ${sessionNumber} actions`}
							className={cn(
								"inline-flex size-9 items-center justify-center rounded-lg border md:hidden",
								"border-foreground/15 bg-background/30 text-foreground/85 shadow-md",
								"hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
							)}
							onClick={(event) => {
								event.stopPropagation();
							}}
							onKeyDown={(event) => {
								event.stopPropagation();
							}}>
							<EllipsisVertical className="size-4" />
						</span>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							onSelect={() => {
								if (isActive) {
									actions.onSessionClose();
									return;
								}

								actions.onSessionSelect(sessionKey, booking.date, booking.time);
							}}>
							{isActive ? "Close" : "Edit"}
						</DropdownMenuItem>
						<DropdownMenuItem
							variant="destructive"
							onSelect={() => {
								actions.onRequestUnschedule(booking._id, booking.date);
							}}>
							Unschedule
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
			{booking ? (
				<span
					role="button"
					tabIndex={0}
					className={cn(
						"peer/unschedule hidden min-h-8 min-w-16 items-center justify-center rounded-lg border px-3 py-1 md:inline-flex",
						"border-foreground/15 bg-background/30 text-foreground/85",
						"outline-none text-xs font-medium tracking-wider shadow-md hover:text-destructive focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
					)}
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						actions.onRequestUnschedule(booking._id, booking.date);
					}}
					onKeyDown={(event) => {
						if (event.key !== "Enter" && event.key !== " ") {
							return;
						}

						event.preventDefault();
						event.stopPropagation();
						actions.onRequestUnschedule(booking._id, booking.date);
					}}>
					UNSCHEDULE
				</span>
			) : null}
			<span
				className={cn(
					booking ? "hidden md:inline-flex" : "inline-flex",
					"min-h-8 min-w-16 items-center justify-center rounded-lg border px-3 py-1",
					!booking && !isActive
						? "border-primary bg-primary text-primary-foreground hover:text-primary-foreground"
						: "border-foreground/15 bg-background/30 text-foreground/85",
					"text-xs font-medium tracking-wider shadow-md group-focus-visible:border-ring group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50",
					(booking || isActive) &&
						"group-hover:text-primary peer-hover/unschedule:text-foreground/85 hover:text-primary"
				)}>
				{editButtonLabel}
			</span>
		</>
	);
}

interface PackageSessionEditorProps {
	actions: PackageSessionActionHandlers;
	availability: BookingDateTimePickerProps["availability"];
	duration: PackageData["duration"];
	hasActiveSession: boolean;
	isDefaultSpace: boolean;
	isSavingDefaultSpace: boolean;
	isSelectedBookingSaved: boolean;
	savingSessionKey: string | null;
	selection: PackageSessionSelection;
	sessionKey: string;
	timeSelectionMessage: BookingDateTimePickerProps["timeSelectionMessage"];
}

function PackageSessionEditor({
	actions,
	availability,
	duration,
	hasActiveSession,
	isDefaultSpace,
	isSavingDefaultSpace,
	isSelectedBookingSaved,
	savingSessionKey,
	selection,
	sessionKey,
	timeSelectionMessage
}: PackageSessionEditorProps) {
	const selectedDateSummary = selection.dateValue
		? formatBookingDateSummaryWithoutYear(selection.dateValue)
		: "No selected date";
	const selectedTimeSummary = selection.time
		? formatBookingTimeRange(selection.time, duration)
		: "No selected time";
	const isSelectionIncomplete = !selection.dateValue || !selection.service || !selection.time;
	const isSaveDisabled =
		!hasActiveSession ||
		isSelectionIncomplete ||
		isSelectedBookingSaved ||
		savingSessionKey !== null;
	let saveButtonText = "SAVE SESSION";

	if (savingSessionKey === sessionKey) {
		saveButtonText = "SAVING";
	} else if (isSelectedBookingSaved) {
		saveButtonText = "SAVED";
	}

	return (
		<AccordionContent className="flex flex-col gap-8 border-t pt-6">
			<div className="flex flex-col gap-6">
				<BookingDateTimePicker
					availability={availability}
					disabled={savingSessionKey !== null}
					onDateChange={actions.onDateChange}
					onTimeChange={actions.onTimeChange}
					selectedTime={selection.time}
					timeSelectionMessage={timeSelectionMessage}
				/>
				<BookingSessionSummary
					dateSummary={selectedDateSummary}
					timeSummary={selectedTimeSummary}
				/>
			</div>
			<div className="flex flex-col gap-4">
				<PackageSessionRecordingSpaceField
					disabled={savingSessionKey !== null}
					isDefault={isDefaultSpace}
					isSavingDefault={isSavingDefaultSpace}
					value={selection.service}
					onChange={actions.onServiceChange}
					onMakeDefault={actions.onMakeDefaultSpace}
				/>
				<PackageSessionRemotePodcastField
					id={`package-session-${sessionKey}-remote-podcast`}
					checked={selection.remotePodcast}
					disabled={savingSessionKey !== null}
					onCheckedChange={actions.onRemotePodcastChange}
				/>
			</div>
			<BookingNotesField
				disabled={savingSessionKey !== null}
				value={selection.notes}
				onChange={actions.onNotesChange}
			/>
			<Button
				type="button"
				className={cn(
					"mt-4 h-12 flex-1",
					"text-base font-bold! tracking-wider",
					"shadow-lg shadow-primary/45"
				)}
				disabled={isSaveDisabled}
				onClick={actions.onRequestSaveSession}>
				{savingSessionKey === sessionKey ? <LoaderCircle className="size-4 animate-spin" /> : null}
				{saveButtonText}
			</Button>
		</AccordionContent>
	);
}
