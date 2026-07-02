import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from "#/components/ui/accordion";
import { Button } from "#/components/ui/button";
import { api } from "#convex/_generated/api";
import type {
	ClearPackageSlotResult,
	GetPackageByTokenResult,
	SavePackageSlotResult
} from "#convex/packageScheduling";
import type { GetPackageBusyWindowsResult } from "#convex/packageSchedulingCalendar";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { BookingModalHost } from "#studio/features/booking-form/components/BookingModalHost";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { BookingDateTimePicker } from "#studio/features/booking-form/components/BookingDateTimePicker";
import { formatEditingAddonLabel } from "#studio/features/booking-form/lib/editing-addon-quantities";
import { getBookingTimeSelectionMessage } from "#studio/features/booking-form/lib/booking-form-model";
import { getPillStateClassName } from "#studio/features/booking-form/lib/booking-form-styles";
import {
	closeBookingModal,
	openPackageSlotConfirmationModal,
	useBookingModalStore
} from "#studio/features/booking-form/lib/booking-modal-store";
import {
	getClearPackageSlotToastMessage,
	getPackageAvailabilityErrorMessage,
	getPackageLinkInvalidMessage,
	getSavePackageSlotToastMessage
} from "#studio/features/booking-form/lib/package-scheduling-errors";
import {
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	formatBookingDateSummary,
	formatBookingTimeRange,
	formatBookingTimestampDateLong,
	formatBookingTimestampTime,
	formatDateValue,
	formatMonthKey,
	formatTimeValue,
	getAvailableTimesForDate,
	getCurrentTimestamp,
	parseDateValue,
	parseMonthKey,
	startOfToday
} from "#studio/lib/bookingdatetime";
import {
	getBookableMonthKeys,
	getSelectedBusyDay,
	isBookingDateDisabled,
	mergeBookableRangeBusyWindows,
	type BusyDayWindow
} from "#studio/features/booking-form/lib/monthly-availability";
import { getAvailabilityRateLimitKey } from "#studio/features/booking-form/lib/saved-booking-info";
import { tryCatch } from "#/lib/result";
import { buildNoIndexHead } from "#/lib/seo";
import { cn } from "#/lib/utils";
import { getTimeZoneDateKey } from "#studio/lib/zonedDateTime";

const BOOKING_TIME_ZONE = "Australia/Sydney";

type PackageScheduleData = NonNullable<GetPackageByTokenResult[1]>;

export const Route = createFileRoute("/_public/multi-booking/$token")({
	head: () => buildNoIndexHead("Schedule Package Sessions | VV Studios"),
	component: MultiBookingSchedulePage
});

function MultiBookingSchedulePage() {
	const { token } = Route.useParams();
	const packageResult = useQuery(api.packageScheduling.getPackageByToken, { token });

	if (packageResult === undefined) {
		return (
			<BookingStatusLayout showActions={false}>
				<StudioLoadingState label="Getting your package..." />
			</BookingStatusLayout>
		);
	}

	const [packageError, packageData] = packageResult;

	if (packageError !== null) {
		const invalidMessage = getPackageLinkInvalidMessage(packageError);
		return (
			<BookingStatusLayout bookingStatus="failed">
				<div>
					<h1 className="text-4xl font-semibold tracking-tight">{invalidMessage.title}</h1>
					<p className="mt-4 text-muted-foreground">{invalidMessage.description}</p>
				</div>
			</BookingStatusLayout>
		);
	}

	return (
		<PackageScheduleContent
			packageData={packageData}
			token={token}
		/>
	);
}

function PackageScheduleContent({
	packageData,
	token
}: {
	packageData: PackageScheduleData;
	token: string;
}) {
	// Convex functions
	const getPackageBusyWindows = useAction(api.packageSchedulingCalendar.getPackageBusyWindows);
	const savePackageSlot = useMutation(api.packageScheduling.savePackageSlot);
	const clearPackageSlot = useMutation(api.packageScheduling.clearPackageSlot);
	const bookingSettings = useQuery(api.bookingSettings.get, {});

	// Availability state
	const availabilitySettings = bookingSettings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS;
	const [availabilityRateLimitKey, setAvailabilityRateLimitKey] = useState<string | null>(null);
	const [availabilityError, setAvailabilityError] = useState("");
	const [monthlyBusyWindowsByMonth, setMonthlyBusyWindowsByMonth] = useState<
		Record<string, BusyDayWindow[]>
	>({});
	const [isLoadingMonthAvailability, setIsLoadingMonthAvailability] = useState(false);
	const [currentTimestamp, setCurrentTimestamp] = useState(getCurrentTimestamp);

	// Slot selection state
	const [activeSlotNumber, setActiveSlotNumber] = useState<number | null>(null);
	const [calendarMonth, setCalendarMonth] = useState(() =>
		parseMonthKey(formatMonthKey(startOfToday()))
	);
	const [selectedDateValue, setSelectedDateValue] = useState("");
	const [selectedTime, setSelectedTime] = useState("");
	const [savingSlotNumber, setSavingSlotNumber] = useState<number | null>(null);
	const [clearingSlotNumber, setClearingSlotNumber] = useState<number | null>(null);

	const today = useMemo(() => startOfToday(), []);
	const selectedDate = parseDateValue(selectedDateValue);
	const expiresDateValue = formatDateValue(new Date(packageData.expiresAt));
	const lastBookableDate = useMemo(
		() => parseDateValue(expiresDateValue) ?? today,
		[expiresDateValue, today]
	);
	const bookableMonthKeys = useMemo(
		() => getBookableMonthKeys(today, lastBookableDate),
		[today, lastBookableDate]
	);
	const visibleMonth = formatMonthKey(calendarMonth);
	const selectedMonth = selectedDateValue ? selectedDateValue.slice(0, 7) : visibleMonth;
	const isViewingSelectedMonth = !selectedDateValue || selectedMonth === visibleMonth;
	const activeSession = packageData.sessions.find(
		(session) => session.slotNumber === activeSlotNumber
	);
	const scheduledSessions = packageData.sessions.filter(
		(session) => session.booking !== null && !session.cancelledAt
	).length;

	// Load the saved availability rate limit key.
	useEffect(() => {
		setAvailabilityRateLimitKey(getAvailabilityRateLimitKey());
	}, []);

	// Keep lock and lead-time checks fresh.
	useEffect(() => {
		const interval = window.setInterval(() => {
			setCurrentTimestamp(getCurrentTimestamp());
		}, 60_000);

		return () => {
			window.clearInterval(interval);
		};
	}, []);

	// Load package-specific calendar availability up to the package expiry date.
	useEffect(() => {
		if (!availabilityRateLimitKey || availabilityError) {
			return;
		}

		const rateLimitKey = availabilityRateLimitKey;
		const hasAllMonthsCached = bookableMonthKeys.every((month) => monthlyBusyWindowsByMonth[month]);
		if (bookableMonthKeys.length === 0 || hasAllMonthsCached) {
			return;
		}

		let isCancelled = false;
		setIsLoadingMonthAvailability(true);

		async function loadPackageAvailability() {
			const [busyWindowsError, result] = await tryCatch<GetPackageBusyWindowsResult>(
				getPackageBusyWindows({ rateLimitKey, token })
			);

			if (isCancelled) {
				return;
			}

			setIsLoadingMonthAvailability(false);

			if (busyWindowsError !== null) {
				console.error("Failed to load package availability", busyWindowsError);
				setAvailabilityError(getPackageAvailabilityErrorMessage(busyWindowsError));
				return;
			}

			setMonthlyBusyWindowsByMonth((current) =>
				mergeBookableRangeBusyWindows({ bookableMonthKeys, current, result })
			);
		}

		void loadPackageAvailability();

		return () => {
			isCancelled = true;
		};
	}, [
		availabilityError,
		availabilityRateLimitKey,
		bookableMonthKeys,
		getPackageBusyWindows,
		monthlyBusyWindowsByMonth,
		token
	]);

	function handleChooseSlot(slotNumber: number, dateValue?: string, time?: string) {
		setActiveSlotNumber(slotNumber);
		setSelectedDateValue(dateValue ?? "");
		setSelectedTime(time ?? "");
	}

	function handleRequestSaveSlot() {
		if (activeSlotNumber === null) {
			toast.error("Choose a session slot first.");
			return;
		}

		if (!selectedDateValue || !selectedTime) {
			toast.error("Please choose a date and time first.");
			return;
		}

		openPackageSlotConfirmationModal({
			date: selectedDateValue,
			dateSummary: formatBookingDateSummary(selectedDateValue),
			modal: "packageSlotConfirmation",
			slotNumber: activeSlotNumber,
			timeSummary: formatBookingTimeRange(selectedTime, packageData.duration),
			time: selectedTime,
			type: "save"
		});
	}

	function handleRequestClearSlot(slotNumber: number, date: string) {
		openPackageSlotConfirmationModal({
			dateSummary: formatBookingDateSummary(date),
			modal: "packageSlotConfirmation",
			slotNumber,
			type: "clear"
		});
	}

	async function handleConfirmSlotAction() {
		const confirmation = useBookingModalStore.getState();

		if (confirmation.modal !== "packageSlotConfirmation") {
			return;
		}

		if (confirmation.type === "save") {
			await handleSaveSlot({
				date: confirmation.date,
				slotNumber: confirmation.slotNumber,
				time: confirmation.time
			});
			return;
		}

		await handleClearSlot(confirmation.slotNumber);
	}

	async function handleSaveSlot(confirmation: { date: string; slotNumber: number; time: string }) {
		setSavingSlotNumber(confirmation.slotNumber);
		const [saveError] = await tryCatch<SavePackageSlotResult>(
			savePackageSlot({
				date: confirmation.date,
				slotNumber: confirmation.slotNumber,
				time: confirmation.time,
				token
			})
		);
		setSavingSlotNumber(null);

		if (saveError !== null) {
			toast.error(getSavePackageSlotToastMessage(saveError));
			return;
		}

		closeBookingModal();
		toast.success(`Session ${confirmation.slotNumber} saved.`);
	}

	async function handleClearSlot(slotNumber: number) {
		setClearingSlotNumber(slotNumber);
		const [clearError] = await tryCatch<ClearPackageSlotResult>(
			clearPackageSlot({ slotNumber, token })
		);
		setClearingSlotNumber(null);

		if (clearError !== null) {
			toast.error(getClearPackageSlotToastMessage(clearError));
			return;
		}

		closeBookingModal();

		if (activeSlotNumber === slotNumber) {
			setSelectedDateValue("");
			setSelectedTime("");
		}

		toast.success(`Session ${slotNumber} cleared.`);
	}

	const selectedBusyDay = selectedDateValue
		? getSelectedBusyDay({ date: selectedDateValue, monthlyBusyWindowsByMonth, selectedMonth })
		: null;
	const availableTimes = getPackageAvailableTimes({
		availabilitySettings,
		currentTimestamp,
		isLoadingMonthAvailability,
		isViewingSelectedMonth,
		lastBookableDate,
		monthlyBusyWindowsByMonth,
		packageDuration: packageData.duration,
		selectedBusyDay,
		selectedDate,
		selectedDateValue,
		selectedMonth,
		today
	});
	const disabledDates = (date: Date) =>
		isBookingDateDisabled({
			currentTimestamp,
			date,
			duration: packageData.duration,
			isAvailabilityRateLimited: false,
			lastBookableDate,
			monthlyBusyWindowsByMonth,
			settings: availabilitySettings,
			today
		});
	const timeSelectionMessage = getBookingTimeSelectionMessage({
		hasDate: Boolean(selectedDateValue),
		hasDuration: true,
		isViewingSelectedMonth
	});
	const availability = {
		availabilityError,
		availableTimes,
		calendarMonth,
		disabledDates,
		isLoadingMonthAvailability,
		isSelectedDateInPast: false,
		isViewingSelectedMonth,
		selectedDate,
		setCalendarMonth
	};

	return (
		<BookingStatusLayout
			showActions={false}
			className="max-w-4xl justify-start pt-16 sm:pt-20">
			<div>
				<h1 className="text-center font-brand text-5xl leading-none uppercase md:text-6xl">
					Schedule your sessions
				</h1>

				<section className="mt-6 text-sm text-card-foreground">
					<h2 className="text-xs! font-semibold uppercase tracking-widest md:text-sm!">
						Package session details
					</h2>
					<dl className="mt-4 grid gap-2 md:grid-cols-3">
						<div className="flex gap-8">
							<dt className="shrink-0 text-muted-foreground">Table setup</dt>
							<dd className="font-medium">
								{packageData.service} ({packageData.duration})
							</dd>
						</div>
						<div className="flex gap-8 md:col-span-2">
							<dt className="shrink-0 text-muted-foreground">Add-ons</dt>
							<dd className="font-medium">{formatPackageAddons(packageData)}</dd>
						</div>
					</dl>
				</section>

				<Accordion
					type="single"
					collapsible
					className="mt-12 grid gap-4"
					value={activeSlotNumber === null ? "" : String(activeSlotNumber)}
					onValueChange={(value) => {
						if (!value) {
							setActiveSlotNumber(null);
							return;
						}

						const slotNumber = Number(value);
						const session = packageData.sessions.find(
							(packageSession) => packageSession.slotNumber === slotNumber
						);
						handleChooseSlot(
							slotNumber,
							session?.cancelledAt ? undefined : session?.booking?.date,
							session?.cancelledAt ? undefined : session?.booking?.time
						);
					}}>
					<div className="flex flex-row justify-between">
						<h2 className="text-primary text-xs! font-semibold uppercase tracking-widest md:text-sm!">Your Sessions</h2>
						<p className="text-sm text-muted-foreground">
							{scheduledSessions} of {packageData.packageSize} sessions scheduled
						</p>
					</div>

					{packageData.sessions.map((session) => {
						const booking = session.cancelledAt ? null : session.booking;
						const isSessionDateReached = Boolean(
							booking &&
							booking.date <= getTimeZoneDateKey(new Date(currentTimestamp), BOOKING_TIME_ZONE)
						);
						const isActive = activeSlotNumber === session.slotNumber;
						const canEdit = !isSessionDateReached;
						const canClear = Boolean(booking && canEdit);

						return (
							<AccordionItem
								key={session.slotNumber}
								value={String(session.slotNumber)}
								disabled={!canEdit}
								className={cn(
									"rounded-xl border bg-card px-6 text-card-foreground shadow-sm last:border-b",
									isSessionDateReached && "bg-background border-muted"
								)}>
								<AccordionTrigger
									showArrow={false}
									className={cn(
										"py-5 hover:no-underline md:py-6",
										!canEdit && "cursor-default hover:text-foreground"
									)}>
									<span className="flex w-full items-center justify-between gap-3">
										<span className="min-w-0">
											<span
												className={cn(
													"block text-base font-semibold",
													booking ? "text-foreground" : "font-light text-muted-foreground"
												)}>
												{booking
													? `${formatBookingTimestampDateLong(booking.sessionStartAt)} at ${formatTimeValue(
															booking.time
														)}`
													: "No date/time scheduled"}
											</span>
											<span className="mt-1 block text-sm font-normal text-muted-foreground">
												Session {session.slotNumber} of {packageData.packageSize}
											</span>
										</span>
										<span className="ml-auto flex shrink-0 items-center justify-end">
											{canEdit ? (
												<span
													className={cn(
														"inline-flex min-h-8 items-center justify-center rounded-lg border px-3 py-1",
														"text-xs font-medium tracking-wider shadow-md",
														getPillStateClassName(false)
													)}>
													{isActive ? "CLOSE" : "EDIT"}
												</span>
											) : (
												<span className="max-w-28 text-right text-xs font-normal text-muted-foreground sm:max-w-none">
													This session can no longer be changed.
												</span>
											)}
										</span>
									</span>
								</AccordionTrigger>

								<AccordionContent className="border-t pt-6">
									<BookingDateTimePicker
										availability={availability}
										onDateChange={(dateValue) => {
											setSelectedDateValue(dateValue);
											setSelectedTime("");
										}}
										onTimeChange={setSelectedTime}
										selectedTime={selectedTime}
										timeSelectionMessage={timeSelectionMessage}
									/>
									<div className="mt-8 flex flex-row w-full items-center justify-center gap-4">
										{canClear ? (
											<Button
												type="button"
												variant="secondary"
												className={cn(
													"h-12 flex-1",
													"text-base text-muted-foreground font-bold! tracking-wider",
													"shadow-lg shadow-primary/45"
												)}
												disabled={clearingSlotNumber === session.slotNumber}
												onClick={() => {
													if (!booking) {
														return;
													}

													handleRequestClearSlot(session.slotNumber, booking.date);
												}}>
												{clearingSlotNumber === session.slotNumber
													? "UNSCHEDULING..."
													: "UNSCHEDULE"}
											</Button>
										) : null}
										<Button
											type="button"
											className={cn(
												"h-12 flex-1",
												"text-base font-bold! tracking-wider",
												"shadow-lg shadow-primary/45"
											)}
											disabled={
												!activeSession ||
												!selectedDateValue ||
												!selectedTime ||
												savingSlotNumber !== null
											}
											onClick={handleRequestSaveSlot}>
											{savingSlotNumber === session.slotNumber
												? "CONFIRMING..."
												: "CONFIRM SESSION"}
										</Button>
									</div>
								</AccordionContent>
							</AccordionItem>
						);
					})}
				</Accordion>

				<p className="mt-6 text-center text-xs text-muted-foreground">
					Sessions can be changed until the day they start. Package scheduling expires{" "}
					{formatBookingTimestampTime(packageData.expiresAt)},{" "}
					{formatBookingTimestampDateLong(packageData.expiresAt)}.
				</p>
			</div>
			<BookingModalHost
				isSubmitting={savingSlotNumber !== null || clearingSlotNumber !== null}
				onPackageSlotConfirm={handleConfirmSlotAction}
				onPaymentClose={() => {}}
				onTermsConfirm={() => {}}
			/>
		</BookingStatusLayout>
	);
}

function getPackageAvailableTimes({
	availabilitySettings,
	currentTimestamp,
	isLoadingMonthAvailability,
	isViewingSelectedMonth,
	lastBookableDate,
	monthlyBusyWindowsByMonth,
	packageDuration,
	selectedBusyDay,
	selectedDate,
	selectedDateValue,
	selectedMonth,
	today
}: {
	availabilitySettings: typeof DEFAULT_BOOKING_AVAILABILITY_SETTINGS;
	currentTimestamp: number;
	isLoadingMonthAvailability: boolean;
	isViewingSelectedMonth: boolean;
	lastBookableDate: Date;
	monthlyBusyWindowsByMonth: Record<string, BusyDayWindow[]>;
	packageDuration: string;
	selectedBusyDay: BusyDayWindow | null;
	selectedDate: Date | undefined;
	selectedDateValue: string;
	selectedMonth: string;
	today: Date;
}) {
	if (
		!selectedDateValue ||
		!selectedDate ||
		selectedDate < today ||
		selectedDate > lastBookableDate
	) {
		return [];
	}

	if (!isViewingSelectedMonth) {
		return [];
	}

	if (isLoadingMonthAvailability && !monthlyBusyWindowsByMonth[selectedMonth]) {
		return [];
	}

	return getAvailableTimesForDate({
		busyPeriods: selectedBusyDay?.busyPeriods ?? [],
		currentTimestamp,
		dateValue: selectedDateValue,
		duration: packageDuration,
		settings: availabilitySettings
	});
}

function formatPackageAddons(packageData: PackageScheduleData) {
	if (packageData.addons.length === 0) {
		return "None";
	}

	return packageData.addons
		.map((addon) =>
			formatEditingAddonLabel(addon, {
				clipsPackageQuantity: packageData.clipsPackageQuantity,
				essentialEditQuantity: packageData.essentialEditQuantity
			})
		)
		.join(", ");
}
