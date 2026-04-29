import { useStore } from "@tanstack/react-store";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { Label } from "#/components/ui/label";
import { BookingContactSection } from "#/features/booking-form/components/BookingContactSection";
import { BookingDateTimeSection } from "#/features/booking-form/components/BookingDateTimeSection.tsx";
import { BookingRecordingSpaceDurationSection } from "#/features/booking-form/components/BookingRecordingSpaceDurationSection.tsx";
import { BookingAddonsSection } from "#/features/booking-form/components/BookingAddonsSection.tsx";
import { TermsDialog } from "#/features/booking-form/components/TermsDialog";
import { BookingSavedInfoBanner } from "#/features/booking-form/components/BookingSavedInfoBanner";
import {
	bookingFormContext,
	type BookingFormApi,
} from "#/features/booking-form/lib/booking-form-context";
import {
	bookingSchema,
	INITIAL_FORM,
	TIME_SECTIONS,
	type TimeSectionKey,
} from "#/features/booking-form/lib/form-shared";
import {
	parseSavedBookingInfo,
	SAVED_BOOKING_INFO_STORAGE_KEY,
	toSavedBookingInfo,
	type SavedBookingInfo,
} from "#/features/booking-form/lib/saved-booking-info";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Field, FieldContent, FieldError, FieldGroup } from "#/components/ui/field";
import {
	formatDateValue,
	formatMonthKey,
	getAvailableTimesForDate,
	getCurrentMonthKey,
	getCurrentTimestamp,
	getLastBookableDate,
	parseDateValue,
	parseMonthKey,
	startOfToday,
	type BusyPeriod,
} from "#/lib/bookingdatetime";
import { api } from "../../convex/_generated/api";
import { BookingPaymentModal } from "#/features/booking-form/components/PaymentModal";

interface BookingErrorWithData {
	data?: {
		code?: string;
	};
}

interface BusyDayWindow {
	busyPeriods: BusyPeriod[];
	date: string;
	label: string;
}

interface EmbeddedCheckoutSession {
	bookingId: Id<"bookings">;
	clientSecret: string;
	stripeSessionId: string;
}

type CreateEmbeddedCheckoutSessionAction = ReturnType<
	typeof useAction<typeof api.stripe.createEmbeddedCheckoutSession>
>;
type CloseEmbeddedCheckoutSessionAction = ReturnType<
	typeof useAction<typeof api.stripe.closeEmbeddedCheckoutSession>
>;

const termsDialogPendingError = new Error("terms-dialog-pending");

export const Route = createFileRoute("/book")({
	component: BookingPage,
});

const pageCopy = {
	title: "Studio Hire Booking",
} as const;

function BookingPage() {
	const createEmbeddedCheckoutSession: CreateEmbeddedCheckoutSessionAction = useAction(
		api.stripe.createEmbeddedCheckoutSession,
	);
	const closeEmbeddedCheckoutSession: CloseEmbeddedCheckoutSessionAction = useAction(
		api.stripe.closeEmbeddedCheckoutSession,
	);
	const [checkoutSession, setCheckoutSession] = useState<EmbeddedCheckoutSession | null>(null);
	const getMonthlyBusyWindows = useAction(api.googleCalendar.getMonthlyBusyWindows);
	const shouldReduceMotion = useReducedMotion();
	const today = startOfToday();
	const lastBookableDate = getLastBookableDate(today);
	const formRef = useRef<HTMLFormElement>(null);
	const dateTimeSectionRef = useRef<HTMLDivElement>(null);
	const completeBookingButtonRef = useRef<HTMLDivElement>(null);

	const [calendarMonth, setCalendarMonth] = useState(() => parseMonthKey(getCurrentMonthKey()));
	const [monthlyBusyWindowsByMonth, setMonthlyBusyWindowsByMonth] = useState<
		Record<string, BusyDayWindow[]>
	>({});
	const [availabilityError, setAvailabilityError] = useState("");
	const [isLoadingMonthAvailability, setIsLoadingMonthAvailability] = useState(false);
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showTermsDialog, setShowTermsDialog] = useState(false);
	const [currentTimestamp, setCurrentTimestamp] = useState(getCurrentTimestamp);
	const [preferredTimeSectionKey, setPreferredTimeSectionKey] = useState<TimeSectionKey | null>(
		null,
	);
	const [savedBookingInfo, setSavedBookingInfo] = useState<SavedBookingInfo | null>(null);
	const [showScrollToCompleteBooking, setShowScrollToCompleteBooking] = useState(false);
	const [shouldSaveBookingInfo, setShouldSaveBookingInfo] = useState(false);
	const submitAfterTermsRef = useRef(false);

	const formApi = useForm({
		defaultValues: INITIAL_FORM,
		validators: {
			onBlur: bookingSchema,
			onSubmit: bookingSchema,
		},
		onSubmit: async ({ value }) => {
			const parsedValue = bookingSchema.parse(value);

			if (!submitAfterTermsRef.current) {
				setShowTermsDialog(true);
				throw termsDialogPendingError;
			}

			submitAfterTermsRef.current = false;
			setError("");
			setIsSubmitting(true);

			try {
				const session = await createEmbeddedCheckoutSession({
					name: parsedValue.name,
					phone: parsedValue.phone,
					accountName: parsedValue.accountName,
					abn: parsedValue.abn || undefined,
					email: parsedValue.email,
					date: parsedValue.date,
					time: parsedValue.time,
					duration: parsedValue.duration,
					service: parsedValue.service,
					addons: parsedValue.addons,
					notes: parsedValue.notes || undefined,
				});

				if (shouldSaveBookingInfo) {
					const nextSavedBookingInfo = toSavedBookingInfo(
						parsedValue,
						preferredTimeSectionKey ?? "",
					);
					window.localStorage.setItem(
						SAVED_BOOKING_INFO_STORAGE_KEY,
						JSON.stringify(nextSavedBookingInfo),
					);
					setSavedBookingInfo(nextSavedBookingInfo);
				} else {
					window.localStorage.removeItem(SAVED_BOOKING_INFO_STORAGE_KEY);
					setSavedBookingInfo(null);
				}

				setCheckoutSession(session);
				setShowTermsDialog(false);

				setCalendarMonth(parseMonthKey(getCurrentMonthKey()));
			} catch (submissionError) {
				setError(getBookingErrorMessage(submissionError));
			} finally {
				setIsSubmitting(false);
				submitAfterTermsRef.current = false;
			}
		},
	});
	const formValues = useStore(formApi.store, (state) => state.values);
	const selectedDate = parseDateValue(formValues.date);
	const isDateTimeIncomplete = !formValues.date || !formValues.time;
	const isSelectedDateInPast = selectedDate ? selectedDate < today : false;
	const isSelectedDateTooFarInFuture = selectedDate ? selectedDate > lastBookableDate : false;
	const visibleMonth = formatMonthKey(calendarMonth);
	const selectedMonth = formValues.date ? formValues.date.slice(0, 7) : visibleMonth;
	const isViewingSelectedMonth = !formValues.date || selectedMonth === visibleMonth;

	useEffect(() => {
		const nextSavedBookingInfo = parseSavedBookingInfo(
			window.localStorage.getItem(SAVED_BOOKING_INFO_STORAGE_KEY),
		);

		if (!nextSavedBookingInfo) {
			window.localStorage.removeItem(SAVED_BOOKING_INFO_STORAGE_KEY);
			return;
		}

		setSavedBookingInfo(nextSavedBookingInfo);
		setShouldSaveBookingInfo(true);
		setPreferredTimeSectionKey(nextSavedBookingInfo.timeSectionKey || null);
	}, []);

	useEffect(() => {
		const cachedBusyDays = monthlyBusyWindowsByMonth[visibleMonth];
		if (cachedBusyDays) {
			setAvailabilityError("");
			setIsLoadingMonthAvailability(false);
			return;
		}

		let isCancelled = false;
		setAvailabilityError("");
		setIsLoadingMonthAvailability(true);

		void getMonthlyBusyWindows({ month: visibleMonth })
			.then((result) => {
				if (isCancelled) {
					return;
				}

				setMonthlyBusyWindowsByMonth((current) => ({
					...current,
					[result.month]: result.busyWindows,
				}));
			})
			.catch((availabilityFetchError) => {
				if (isCancelled) {
					return;
				}

				setAvailabilityError(getBookingErrorMessage(availabilityFetchError));
				console.error("Could not load month availability", availabilityFetchError);
			})
			.finally(() => {
				if (!isCancelled) {
					setIsLoadingMonthAvailability(false);
				}
			});

		return () => {
			isCancelled = true;
		};
	}, [formValues.date, getMonthlyBusyWindows, monthlyBusyWindowsByMonth, visibleMonth]);

	const selectedBusyDay = !formValues.date
		? null
		: (monthlyBusyWindowsByMonth[selectedMonth]?.find((day) => day.date === formValues.date) ??
			null);

	const disabledDates = useMemo(() => {
		return (date: Date) => {
			if (date < today || date > lastBookableDate) {
				return true;
			}

			const monthKey = formatMonthKey(date);
			const busyDays = monthlyBusyWindowsByMonth[monthKey];
			const busyDay = busyDays?.find((day) => day.date === formatDateValue(date));
			const availableTimesForDate = getAvailableTimesForDate({
				busyPeriods: busyDay?.busyPeriods ?? [],
				currentTimestamp,
				dateValue: formatDateValue(date),
				duration: formValues.duration,
			});

			if (!busyDays) {
				return availableTimesForDate.length === 0;
			}

			return availableTimesForDate.length === 0;
		};
	}, [currentTimestamp, formValues.duration, lastBookableDate, monthlyBusyWindowsByMonth, today]);

	const availableTimes = useMemo<string[]>(() => {
		if (
			!formValues.date ||
			isSelectedDateInPast ||
			isSelectedDateTooFarInFuture ||
			!isViewingSelectedMonth
		) {
			return [];
		}

		if (
			selectedMonth === visibleMonth &&
			isLoadingMonthAvailability &&
			!monthlyBusyWindowsByMonth[selectedMonth]
		) {
			return [];
		}

		return getAvailableTimesForDate({
			busyPeriods: selectedBusyDay?.busyPeriods ?? [],
			currentTimestamp,
			dateValue: formValues.date,
			duration: formValues.duration,
		});
	}, [
		currentTimestamp,
		formValues.date,
		formValues.duration,
		isLoadingMonthAvailability,
		isSelectedDateInPast,
		isSelectedDateTooFarInFuture,
		isViewingSelectedMonth,
		monthlyBusyWindowsByMonth,
		selectedBusyDay,
		selectedMonth,
		visibleMonth,
	]);

	const availableTimeSections = TIME_SECTIONS.map((section) => ({
		...section,
		times: availableTimes.filter(section.includes),
	})).filter((section) => section.times.length > 0);

	const scrollToFirstError = () => {
		requestAnimationFrame(() => {
			const fieldOrder = [
				"service",
				"duration",
				"date",
				"time",
				"name",
				"phone",
				"accountName",
				"abn",
				"email",
				"notes",
			];

			for (const fieldName of fieldOrder) {
				const fieldContainer = formRef.current?.querySelector<HTMLElement>(
					`[data-field-name="${fieldName}"]`,
				);
				const fieldError = fieldContainer?.querySelector<HTMLElement>('[data-slot="field-error"]');

				if (fieldContainer && fieldError) {
					fieldContainer.scrollIntoView({
						behavior: "smooth",
						block: "center",
					});
					return;
				}
			}
		});
	};

	useEffect(() => {
		const interval = window.setInterval(() => {
			setCurrentTimestamp(getCurrentTimestamp());
		}, 60_000);

		return () => {
			window.clearInterval(interval);
		};
	}, []);

	useEffect(() => {
		if (
			!formValues.date ||
			isSelectedDateInPast ||
			isSelectedDateTooFarInFuture ||
			!isViewingSelectedMonth
		) {
			if (formValues.time) {
				formApi.setFieldValue("time", "");
			}
			return;
		}

		if (
			selectedMonth === visibleMonth &&
			isLoadingMonthAvailability &&
			!monthlyBusyWindowsByMonth[selectedMonth]
		) {
			return;
		}

		if (availableTimes.length === 0) {
			if (formValues.time) {
				formApi.setFieldValue("time", "");
			}
			return;
		}

		if (formValues.time && !availableTimes.includes(formValues.time)) {
			formApi.setFieldValue("time", "");
		}
	}, [
		availableTimes,
		formApi,
		formValues.date,
		formValues.time,
		isLoadingMonthAvailability,
		isSelectedDateInPast,
		isSelectedDateTooFarInFuture,
		isViewingSelectedMonth,
		monthlyBusyWindowsByMonth,
		selectedMonth,
		visibleMonth,
	]);

	const handlePaymentModalClose = () => {
		const activeCheckoutSession = checkoutSession;
		setCheckoutSession(null);

		if (!activeCheckoutSession) {
			return;
		}

		void closeEmbeddedCheckoutSession({
			bookingId: activeCheckoutSession.bookingId,
			stripeSessionId: activeCheckoutSession.stripeSessionId,
		}).catch((closeCheckoutError) => {
			console.error("Could not close embedded checkout session", closeCheckoutError);
		});
	};

	const handleTermsConfirm = () => {
		submitAfterTermsRef.current = true;
		formRef.current?.requestSubmit();
	};

	const handleReuseSavedBookingInfo = () => {
		if (!savedBookingInfo) {
			return;
		}

		formApi.setFieldValue("service", savedBookingInfo.service);
		formApi.setFieldValue("duration", savedBookingInfo.duration);
		formApi.setFieldValue("addons", [...savedBookingInfo.addons]);
		formApi.setFieldValue("name", savedBookingInfo.name);
		formApi.setFieldValue("phone", savedBookingInfo.phone);
		formApi.setFieldValue("accountName", savedBookingInfo.accountName);
		formApi.setFieldValue("abn", savedBookingInfo.abn);
		formApi.setFieldValue("email", savedBookingInfo.email);
		formApi.setFieldValue("notes", savedBookingInfo.notes);
		setPreferredTimeSectionKey(savedBookingInfo.timeSectionKey || null);
		setShowScrollToCompleteBooking(true);
	};

	const handleSaveBookingInfoChange = (checked: boolean) => {
		setShouldSaveBookingInfo(checked);

		if (!checked) {
			window.localStorage.removeItem(SAVED_BOOKING_INFO_STORAGE_KEY);
			setSavedBookingInfo(null);
		}
	};

	const handleScrollToCompleteBooking = () => {
		const scrollTarget = isDateTimeIncomplete
			? dateTimeSectionRef.current
			: completeBookingButtonRef.current;

		scrollTarget?.scrollIntoView({
			behavior: "smooth",
			block: isDateTimeIncomplete ? "start" : "center",
		});
	};

	return (
		<main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-4 pb-12">
			<h1 className="text-2xl leading-none font-bold md:text-4xl">{pageCopy.title}</h1>
			{savedBookingInfo ? <BookingSavedInfoBanner onReuse={handleReuseSavedBookingInfo} /> : null}

			<bookingFormContext.Provider value={formApi as unknown as BookingFormApi}>
				<form
					ref={formRef}
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						void formApi
							.handleSubmit()
							.then(() => {
								if (!formApi.state.isValid) {
									submitAfterTermsRef.current = false;
									scrollToFirstError();
								}
							})
							.catch((submissionError) => {
								if (submissionError !== termsDialogPendingError) {
									console.error("Booking form submission failed", submissionError);
								}
							});
					}}
					className="flex flex-col gap-10">
					<FieldGroup className="flex flex-col gap-8 md:gap-12">
						<BookingRecordingSpaceDurationSection />
						<div
							ref={dateTimeSectionRef}
							className="scroll-mt-32 sm:scroll-mt-40">
							<BookingDateTimeSection
								availabilityError={availabilityError}
								availableTimeSections={availableTimeSections}
								calendarMonth={calendarMonth}
								disabledDates={disabledDates}
								isLoadingMonthAvailability={isLoadingMonthAvailability}
								isSelectedDateInPast={isSelectedDateInPast}
								isViewingSelectedMonth={isViewingSelectedMonth}
								onPreferredTimeSectionChange={setPreferredTimeSectionKey}
								preferredTimeSectionKey={preferredTimeSectionKey}
								selectedDate={selectedDate}
								setCalendarMonth={setCalendarMonth}
							/>
						</div>
						<BookingAddonsSection />
						<BookingContactSection />
					</FieldGroup>

					{error ? <FieldError>{error}</FieldError> : null}

					<Field
						orientation="horizontal"
						className="items-center! gap-2">
						<Checkbox
							id="save-booking-info"
							checked={shouldSaveBookingInfo}
							className="size-5 rounded-full"
							onCheckedChange={(checked) => handleSaveBookingInfoChange(checked === true)}
						/>
						<FieldContent className="justify-center gap-0">
							<Label
								htmlFor="save-booking-info"
								className="cursor-pointer text-sm">
								Save booking information on this device for next time
							</Label>
						</FieldContent>
					</Field>

					<div ref={completeBookingButtonRef}>
						<Button
							type="submit"
							className="h-12 w-full rounded-lg text-base font-bold! tracking-wider"
							disabled={isSubmitting}>
							COMPLETE BOOKING
						</Button>
					</div>
				</form>
			</bookingFormContext.Provider>

			<AnimatePresence>
				{showScrollToCompleteBooking ? (
					<motion.div
						key="scroll-to-booking-target"
						initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 1, scale: 1.8 }}
						animate={{ opacity: 1, scale: 1 }}
						whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
						transition={
							shouldReduceMotion
								? { duration: 0.2 }
								: {
										type: "spring",
										stiffness: 220,
										damping: 8,
										mass: 1,
									}
						}
						className="fixed right-4 bottom-16 z-50 sm:right-6 sm:bottom-6">
						<Button
							type="button"
							size="icon-lg"
							aria-label={
								isDateTimeIncomplete
									? "Scroll to date and time section"
									: "Scroll to complete booking"
							}
							className="rounded-full shadow-md"
							onClick={handleScrollToCompleteBooking}>
							<ChevronDown className="size-6" />
						</Button>
					</motion.div>
				) : null}
			</AnimatePresence>

			<TermsDialog
				open={showTermsDialog}
				isSubmitting={isSubmitting}
				onConfirm={handleTermsConfirm}
				onOpenChange={setShowTermsDialog}
			/>

			{checkoutSession ? (
				<BookingPaymentModal
					clientSecret={checkoutSession.clientSecret}
					onClose={handlePaymentModalClose}
				/>
			) : null}
		</main>
	);
}

function getBookingErrorMessage(error: unknown) {
	const errorWithData =
		typeof error === "object" && error !== null ? (error as BookingErrorWithData) : null;
	const code = errorWithData?.data?.code;

	if (code === "BOOKING_TIME_UNAVAILABLE") {
		return "That time was just taken. Please choose another available time.";
	}

	if (code === "GOOGLE_CALENDAR_AUTH_FAILED") {
		return "Google Calendar authentication failed. Regenerate the refresh token and try again.";
	}

	if (code === "GOOGLE_CALENDAR_AVAILABILITY_FAILED") {
		return "Could not load availability right now. Check the Convex logs for the Google error details.";
	}

	return error instanceof Error ? error.message : "Something went wrong.";
}
