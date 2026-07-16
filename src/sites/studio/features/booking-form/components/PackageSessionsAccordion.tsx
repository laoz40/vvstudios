import { Armchair, EllipsisVertical, Globe, LoaderCircle } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from "#/components/ui/accordion";
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
import { PackageSessionRecordingSpaceField } from "#studio/features/booking-form/components/PackageSessionRecordingSpaceField";
import { PackageSessionRemotePodcastField } from "#studio/features/booking-form/components/PackageSessionRemotePodcastField";
import { BookingSessionSummary } from "#studio/features/booking-form/components/BookingSessionSummary";
import { isPackageSessionLocked } from "#studio/features/booking-form/lib/package-scheduling-rules";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";
import {
	formatBookingDateCompact,
	formatBookingDateSummaryWithoutYear,
	formatBookingTimeRange,
	formatBookingTimestampDateLong
} from "#studio/lib/bookingdatetime";
import { cn } from "#/lib/utils";

const SESSION_STATUS_DETAILS = {
	dateRequired: { label: "DATE REQUIRED", textClassName: "text-destructive" },
	upcoming: { label: "UPCOMING", textClassName: "text-green" },
	completed: { label: "COMPLETED", textClassName: "text-green-completed" }
} as const;

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
	const scheduledSessions = [...packageData.bookings]
		.sort(
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
				const statusDetails = SESSION_STATUS_DETAILS[session.status];
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
					saveButtonText = "SAVING";
				} else if (isSelectedBookingSaved) {
					saveButtonText = "SAVED";
				}

				return (
					<AccordionItem
						key={session.key}
						value={session.key}
						disabled={!canEdit}
						className={cn(
							"rounded-xl border bg-surface-subtle px-4 last:border-b sm:px-6",
							"text-card-foreground",
							"shadow-lg transition-colors duration-500",
							session.status === "completed" &&
								"border-muted bg-background opacity-70 shadow-none!",
							isHighlighted && "border-primary"
						)}>
						<AccordionTrigger
							showArrow={false}
							className={cn(
								"min-h-24 items-center py-5 hover:no-underline focus-visible:ring-0 focus-visible:ring-offset-0 md:py-6",
								!canEdit && "cursor-default hover:text-foreground"
							)}>
							<span className="flex w-full items-center justify-between gap-4 sm:gap-6">
								<span className="shrink-0 text-sm text-muted-foreground">{index + 1}</span>
								<span className="flex min-w-0 flex-1 flex-col items-start gap-1">
									<Badge
										variant="ghost"
										className={cn(
											"rounded-none border-0 bg-transparent p-0 tracking-wider",
											statusDetails.textClassName
										)}>
										{statusDetails.label}
									</Badge>
									<span className="block select-text! text-left text-base text-muted-foreground transition-colors duration-500">
										{booking ? (
											<>
												<span className="font-semibold text-foreground">
													<span className="md:hidden">
														{formatBookingDateCompact(booking.date)}
													</span>
													<span className="hidden md:inline">
														{formatBookingTimestampDateLong(booking.sessionStartAt)}
													</span>
												</span>{" "}
												· {formatBookingTimeRange(booking.time, packageData.duration)}
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
											</>
										) : (
											<>
												<span className="md:hidden">Set your session date</span>
												<span className="hidden md:inline">
													Pick a date to confirm your session
												</span>
											</>
										)}
									</span>
								</span>
								<span className="ml-auto flex shrink-0 items-center justify-end gap-2">
									{session.status === "upcoming" && isSessionLocked ? (
										<span className="hidden whitespace-nowrap text-right text-xs text-muted-foreground md:inline">
											This session can no longer be edited.
										</span>
									) : null}
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
									) : null}
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
