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
import { BookingSessionSummary } from "#studio/features/booking-form/components/BookingSessionSummary";
import { sectionHeadingClassName } from "#studio/features/booking-form/lib/booking-form-styles";
import { isPackageSessionLocked } from "#studio/features/booking-form/lib/package-scheduling-rules";
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
	packageData: NonNullable<GetPackageByTokenResult[1]>;
	savingSessionKey: string | null;
	selectedDateValue: string;
	selectedNotes: string;
	selectedTime: string;
	timeSelectionMessage: BookingDateTimePickerProps["timeSelectionMessage"];
	leadTimeMinutes: number;
	currentTimestamp: number;
	onDateChange: (dateValue: string) => void;
	onNotesChange: (notes: string) => void;
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
	packageData,
	savingSessionKey,
	selectedDateValue,
	selectedNotes,
	selectedTime,
	timeSelectionMessage,
	leadTimeMinutes,
	currentTimestamp,
	onDateChange,
	onNotesChange,
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
			className="mt-12 grid gap-4 [&_[data-slot=accordion-content][data-state=open]]:overflow-visible"
			value={activeSessionKey ?? ""}
			onValueChange={(value) => {
				if (!value) {
					onSessionClose();
					return;
				}

				const session = sessions.find((packageSession) => packageSession.key === value);
				onSessionSelect(value, session?.booking?.date, session?.booking?.time);
			}}>
			<div className="flex flex-row justify-between">
				<h2 className={sectionHeadingClassName}>Your Sessions</h2>
				<p className="text-sm text-muted-foreground">
					You have {packageData.packageSize - packageData.bookings.length} sessions left to
					schedule.
				</p>
			</div>

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
								"min-h-24 items-center py-5 hover:no-underline md:py-6",
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
												{formatBookingTimeRange(booking.time, packageData.duration)}
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
												"text-xs font-medium tracking-wider shadow-md hover:text-destructive"
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
												"text-xs font-medium tracking-wider shadow-md",
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

						<AccordionContent className="flex flex-col border-t pt-6 gap-6">
							<BookingDateTimePicker
								availability={availability}
								onDateChange={onDateChange}
								onTimeChange={onTimeChange}
								selectedTime={selectedTime}
								timeSelectionMessage={timeSelectionMessage}
							/>
							<BookingSessionSummary
								dateSummary={selectedDateSummary}
								timeSummary={selectedTimeSummary}
							/>
							<BookingNotesField
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
