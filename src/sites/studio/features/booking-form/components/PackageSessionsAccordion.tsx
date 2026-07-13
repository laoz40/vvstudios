import { EllipsisVertical, LoaderCircle } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from "#/components/ui/accordion";
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
import { PackageSessionRecordingSpaceField } from "#studio/features/booking-form/components/PackageSessionRecordingSpaceField";
import { PackageSessionRemotePodcastField } from "#studio/features/booking-form/components/PackageSessionRemotePodcastField";
import { BookingSessionSummary } from "#studio/features/booking-form/components/BookingSessionSummary";
import { isPackageSessionLocked } from "#studio/features/booking-form/lib/package-scheduling-rules";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";
import {
	formatBookingDateSummaryWithoutYear,
	formatBookingTimeRange,
	formatBookingTimestampDateLong
} from "#studio/lib/bookingdatetime";
import { cn } from "#/lib/utils";

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
	const sessions = [
		...packageData.bookings.map((booking) => ({ booking, key: booking._id })),
		...Array.from(
			{ length: packageData.packageSize - packageData.bookings.length },
			(_, index) => ({ booking: null, key: `empty-${index}` })
		)
	];
	const hasActiveSession = sessions.some((session) => session.key === activeSessionKey);
	const selectedDateSummary = selectedDateValue
		? formatBookingDateSummaryWithoutYear(selectedDateValue)
		: "No selected date";
	const selectedTimeSummary = selectedTime
		? formatBookingTimeRange(selectedTime, packageData.duration)
		: "No selected time";

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
			{sessions.map((session, index) => {
				const booking = session.booking;
				const isPastSession = Boolean(booking && booking.sessionStartAt < currentTimestamp);
				const isSessionLocked = Boolean(
					booking &&
					isPackageSessionLocked(booking.sessionStartAt, leadTimeMinutes, currentTimestamp)
				);
				const isActive = activeSessionKey === session.key;
				const canEdit = !isSessionLocked;
				const canClear = Boolean(booking && canEdit);
				const isHighlighted = highlightedBookingId === booking?._id;
				const isSelectedBookingSaved = Boolean(
					booking &&
					booking.date === selectedDateValue &&
					booking.time === selectedTime &&
					booking.service === selectedService &&
					booking.notes === selectedNotes
				);
				let saveButtonText = "SAVE SESSION";

				if (savingSessionKey === session.key) {
					saveButtonText = "SAVING...";
				} else if (isSelectedBookingSaved) {
					saveButtonText = "SAVED";
				}

				return (
					<AccordionItem
						key={session.key}
						value={session.key}
						disabled={!canEdit}
						className={cn(
							"rounded-xl border bg-surface-subtle px-4 sm:px-6",
							"text-card-foreground",
							"shadow-lg transition-colors duration-500",
							isPastSession && "bg-background opacity-70 border-muted shadow-none!",
							isHighlighted && "border-primary"
						)}>
						<AccordionTrigger
							showArrow={false}
							className={cn(
								"min-h-24 items-center py-5 hover:no-underline focus-visible:ring-0 focus-visible:ring-offset-0 md:py-6",
								!canEdit && "cursor-default hover:text-foreground"
							)}>
							<span className="flex w-full items-center justify-between gap-6">
								<span className="shrink-0 text-sm text-muted-foreground">{index + 1}</span>
								<span className="min-w-0">
									{booking ? (
										<span
											className={cn(
												"block text-base font-semibold transition-colors duration-500",
												isHighlighted ? "text-primary" : "text-foreground"
											)}>
											<span className="block">
												{formatBookingTimestampDateLong(booking.sessionStartAt)}
											</span>
											<span className="mt-1 block text-sm font-normal text-muted-foreground">
												{formatBookingTimeRange(booking.time, packageData.duration)} ·{" "}
												{booking.service}
												{booking.addons.includes("Remote Podcast") ? " (Remote)" : ""}
											</span>
										</span>
									) : (
										<span className="block text-sm font-light text-muted-foreground transition-colors duration-500">
											No date/time scheduled
										</span>
									)}
								</span>
								<span className="ml-auto flex shrink-0 items-center justify-end gap-2">
									{canClear ? (
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<span
													role="button"
													tabIndex={0}
													aria-label={`Open session ${index + 1} actions`}
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
															onSessionClose();
															return;
														}

														onSessionSelect(session.key, booking?.date, booking?.time);
													}}>
													{isActive ? "Close" : "Edit"}
												</DropdownMenuItem>
												<DropdownMenuItem
													variant="destructive"
													onSelect={() => {
														if (!booking) {
															return;
														}

														onRequestUnschedule(booking._id, booking.date);
													}}>
													Unschedule
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									) : null}
									{canClear ? (
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

												if (!booking) {
													return;
												}

												onRequestUnschedule(booking._id, booking.date);
											}}
											onKeyDown={(event) => {
												if (event.key !== "Enter" && event.key !== " ") {
													return;
												}

												event.preventDefault();
												event.stopPropagation();

												if (!booking) {
													return;
												}

												onRequestUnschedule(booking._id, booking.date);
											}}>
											UNSCHEDULE
										</span>
									) : null}
									{canEdit ? (
										<span
											className={cn(
												canClear ? "hidden md:inline-flex" : "inline-flex",
												"min-h-8 min-w-16 items-center justify-center rounded-lg border px-3 py-1",
												!booking && !isActive
													? "border-primary bg-primary text-primary-foreground hover:text-primary-foreground"
													: "border-foreground/15 bg-background/30 text-foreground/85",
												"text-xs font-medium tracking-wider shadow-md group-focus-visible:border-ring group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50",
												(booking || isActive) &&
													"group-hover:text-primary peer-hover/unschedule:text-foreground/85 hover:text-primary"
											)}>
											{isActive ? "CLOSE" : booking ? "EDIT" : "SCHEDULE"}
										</span>
									) : (
										<span className="max-w-28 text-right text-xs font-normal text-muted-foreground sm:max-w-none">
											Completed
										</span>
									)}
								</span>
							</span>
						</AccordionTrigger>

						<AccordionContent className="flex flex-col gap-8 border-t pt-6">
							<div className="flex flex-col gap-6">
								<BookingDateTimePicker
									availability={availability}
									disabled={savingSessionKey !== null}
									onDateChange={onDateChange}
									onTimeChange={onTimeChange}
									selectedTime={selectedTime}
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
									value={selectedService}
									onChange={onServiceChange}
									onMakeDefault={onMakeDefaultSpace}
								/>
								<PackageSessionRemotePodcastField
									id={`package-session-${session.key}-remote-podcast`}
									checked={selectedRemotePodcast}
									disabled={savingSessionKey !== null}
									onCheckedChange={onRemotePodcastChange}
								/>
							</div>
							<BookingNotesField
								disabled={savingSessionKey !== null}
								value={selectedNotes}
								onChange={onNotesChange}
							/>
							<Button
								type="button"
								className={cn(
									"mt-4 h-12 flex-1",
									"text-base font-bold! tracking-wider",
									"shadow-lg shadow-primary/45"
								)}
								disabled={
									!hasActiveSession ||
									!selectedDateValue ||
									!selectedService ||
									!selectedTime ||
									isSelectedBookingSaved ||
									savingSessionKey !== null
								}
								onClick={onRequestSaveSession}>
								{savingSessionKey === session.key ? (
									<LoaderCircle className="size-4 animate-spin" />
								) : null}
								{saveButtonText}
							</Button>
						</AccordionContent>
					</AccordionItem>
				);
			})}
		</Accordion>
	);
}
