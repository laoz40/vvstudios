import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@tanstack/react-store";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { ChevronDown } from "lucide-react";

import { toast } from "sonner";
import type { Id } from "#convex/_generated/dataModel";
import {
	BookDevErrorPanel,
	type BookDevErrorCode,
} from "#studio/components/booking/BookDevErrorPanel";
import { Label } from "#/components/ui/label";
import { BookingContactSection } from "#studio/features/booking-form/components/BookingContactSection";
import { BookingDateTimeSection } from "#studio/features/booking-form/components/BookingDateTimeSection.tsx";
import {
	BookingRecordingSpaceDurationSection,
	BookingRecurringSessionsPrompt,
} from "#studio/features/booking-form/components/BookingRecordingSpaceDurationSection.tsx";
import { BookingAddonsSection } from "#studio/features/booking-form/components/BookingAddonsSection.tsx";
import { TermsDialog } from "#studio/features/booking-form/components/TermsDialog";
import { BookingSavedInfoBanner } from "#studio/features/booking-form/components/BookingSavedInfoBanner";
import {
	bookingFormContext,
	type BookingFormApi,
} from "#studio/features/booking-form/lib/booking-form-context";
import {
	bookingSchema,
	INITIAL_FORM,
	TIME_SECTIONS,
	type TimeSectionKey,
} from "#studio/features/booking-form/lib/form-shared";
import {
	getBookingErrorMessage,
	getBookingSubmitFailureMessage,
} from "#studio/features/booking-form/lib/booking-errors";
import {
	getAvailabilityRateLimitKey,
	getStoredSavedBookingInfo,
	removeStoredSavedBookingInfo,
	storeSavedBookingInfo,
	toSavedBookingInfo,
	type SavedBookingInfo,
} from "#studio/features/booking-form/lib/saved-booking-info";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Field, FieldContent, FieldGroup } from "#/components/ui/field";
import {
	formatDateValue,
	formatMonthKey,
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	getAvailableTimesForDate,
	getCurrentMonthKey,
	getCurrentTimestamp,
	getLastBookableDate,
	parseDateValue,
	parseMonthKey,
	startOfToday,
} from "#studio/lib/bookingdatetime";
import { api } from "#convex/_generated/api";
import {
	getBookableMonthKeys,
	getSelectedBusyDay,
	getUncachedMonthKeys,
	isAvailabilityRateLimitedMessage,
	isBookingDateDisabled,
	mergeBookableRangeBusyWindows,
	type BusyDayWindow,
} from "#studio/features/booking-form/lib/monthly-availability";
import { buildSeoHead, seoMetadata } from "#/lib/seo";

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
const loadBookingPaymentModal = () =>
	import("#studio/features/booking-form/components/PaymentModal").then((module) => ({
		default: module.BookingPaymentModal,
	}));
const BookingPaymentModal = lazy(loadBookingPaymentModal);

export const Route = createFileRoute("/_public/book")({
	head: () => buildSeoHead(seoMetadata.book),
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
	const getBookableRangeBusyWindows = useAction(api.googleCalendar.getBookableRangeBusyWindows);
	const bookingSettings = useQuery(api.bookingSettings.get, {});
	const availabilitySettings = bookingSettings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS;
	const today = startOfToday();
	const lastBookableDate = getLastBookableDate(today, availabilitySettings.maxDaysAhead);
	const formRef = useRef<HTMLFormElement>(null);
	const dateTimeSectionRef = useRef<HTMLDivElement>(null);
	const completeBookingButtonRef = useRef<HTMLDivElement>(null);

	const [calendarMonth, setCalendarMonth] = useState(() => parseMonthKey(getCurrentMonthKey()));
	const [monthlyBusyWindowsByMonth, setMonthlyBusyWindowsByMonth] = useState<
		Record<string, BusyDayWindow[]>
	>({});
	const [availabilityRateLimitKey, setAvailabilityRateLimitKey] = useState<string | null>(null);
	const [availabilityError, setAvailabilityError] = useState("");
	const [isLoadingMonthAvailability, setIsLoadingMonthAvailability] = useState(false);
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
				void loadBookingPaymentModal();
				throw termsDialogPendingError;
			}

			submitAfterTermsRef.current = false;
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
					notes: parsedValue.notes,
				});

				if (!session.ok) {
					toast.error(getBookingSubmitFailureMessage(session));
					return;
				}

				if (shouldSaveBookingInfo) {
					const nextSavedBookingInfo = toSavedBookingInfo(
						parsedValue,
						preferredTimeSectionKey ?? "",
					);
					storeSavedBookingInfo(nextSavedBookingInfo);
					setSavedBookingInfo(nextSavedBookingInfo);
				} else {
					removeStoredSavedBookingInfo();
					setSavedBookingInfo(null);
				}

				setCheckoutSession(session);
				setShowTermsDialog(false);

				setCalendarMonth(parseMonthKey(getCurrentMonthKey()));
			} catch (submissionError) {
				toast.error(getBookingErrorMessage(submissionError));
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
	const bookableStartDateValue = formatDateValue(today);
	const bookableEndDateValue = formatDateValue(lastBookableDate);
	const bookableMonthKeys = useMemo(() => {
		const startDate = parseDateValue(bookableStartDateValue);
		const endDate = parseDateValue(bookableEndDateValue);

		return startDate && endDate ? getBookableMonthKeys(startDate, endDate) : [];
	}, [bookableStartDateValue, bookableEndDateValue]);
	const visibleMonth = formatMonthKey(calendarMonth);
	const selectedMonth = formValues.date ? formValues.date.slice(0, 7) : visibleMonth;
	const isViewingSelectedMonth = !formValues.date || selectedMonth === visibleMonth;
	const isAvailabilityRateLimited = isAvailabilityRateLimitedMessage(availabilityError);

	// load availability rate limit key
	useEffect(() => {
		setAvailabilityRateLimitKey(getAvailabilityRateLimitKey());
	}, []);

	// load saved booking info
	useEffect(() => {
		const nextSavedBookingInfo = getStoredSavedBookingInfo();

		if (!nextSavedBookingInfo) {
			removeStoredSavedBookingInfo();
			return;
		}

		setSavedBookingInfo(nextSavedBookingInfo);
		setShouldSaveBookingInfo(true);
		setPreferredTimeSectionKey(nextSavedBookingInfo.timeSectionKey || null);
	}, []);

	// fetch calendar availability
	useEffect(() => {
		if (!availabilityRateLimitKey) {
			return;
		}

		const uncachedMonthKeys = getUncachedMonthKeys(bookableMonthKeys, monthlyBusyWindowsByMonth);
		if (uncachedMonthKeys.length === 0) {
			setAvailabilityError("");
			setIsLoadingMonthAvailability(false);
			return;
		}

		let isCancelled = false;
		setAvailabilityError("");
		setIsLoadingMonthAvailability(true);

		void getBookableRangeBusyWindows({
			rateLimitKey: availabilityRateLimitKey,
		})
			.then((result) => {
				if (isCancelled) {
					return;
				}

				setMonthlyBusyWindowsByMonth((current) =>
					mergeBookableRangeBusyWindows({ bookableMonthKeys, current, result }),
				);
			})
			.catch((availabilityFetchError) => {
				if (isCancelled) {
					return;
				}

				const errorMessage = getBookingErrorMessage(availabilityFetchError);
				setAvailabilityError(errorMessage);
				toast.error(errorMessage);
			})
			.finally(() => {
				if (!isCancelled) {
					setIsLoadingMonthAvailability(false);
				}
			});

		return () => {
			isCancelled = true;
		};
	}, [
		availabilityRateLimitKey,
		bookableMonthKeys,
		getBookableRangeBusyWindows,
		monthlyBusyWindowsByMonth,
	]);

	const selectedBusyDay = formValues.date
		? getSelectedBusyDay({
				date: formValues.date,
				monthlyBusyWindowsByMonth,
				selectedMonth,
			})
		: null;

	const disabledDates = useMemo(() => {
		return (date: Date) =>
			isBookingDateDisabled({
				currentTimestamp,
				date,
				duration: formValues.duration,
				isAvailabilityRateLimited,
				lastBookableDate,
				monthlyBusyWindowsByMonth,
				settings: availabilitySettings,
				today,
			});
	}, [
		currentTimestamp,
		formValues.duration,
		isAvailabilityRateLimited,
		lastBookableDate,
		monthlyBusyWindowsByMonth,
		availabilitySettings,
		today,
	]);

	const availableTimes = useMemo<string[]>(() => {
		if (
			!formValues.date ||
			isSelectedDateInPast ||
			isSelectedDateTooFarInFuture ||
			!isViewingSelectedMonth
		) {
			return [];
		}

		if (isLoadingMonthAvailability && !monthlyBusyWindowsByMonth[selectedMonth]) {
			return [];
		}

		return getAvailableTimesForDate({
			busyPeriods: selectedBusyDay?.busyPeriods ?? [],
			currentTimestamp,
			dateValue: formValues.date,
			duration: formValues.duration,
			settings: availabilitySettings,
		});
	}, [
		currentTimestamp,
		formValues.date,
		formValues.duration,
		availabilitySettings,
		isLoadingMonthAvailability,
		isSelectedDateInPast,
		isSelectedDateTooFarInFuture,
		isViewingSelectedMonth,
		monthlyBusyWindowsByMonth,
		selectedBusyDay,
		selectedMonth,
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

	// keep time based availability fresh
	useEffect(() => {
		const interval = window.setInterval(() => {
			setCurrentTimestamp(getCurrentTimestamp());
		}, 60_000);

		return () => {
			window.clearInterval(interval);
		};
	}, []);

	// clear invalid selected time
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

		if (isLoadingMonthAvailability && !monthlyBusyWindowsByMonth[selectedMonth]) {
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
			toast.error(getBookingErrorMessage(closeCheckoutError));
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

	const handleRemoveSavedBookingInfo = () => {
		removeStoredSavedBookingInfo();
		setSavedBookingInfo(null);
		setShouldSaveBookingInfo(false);
	};

	const handleSaveBookingInfoChange = (checked: boolean) => {
		setShouldSaveBookingInfo(checked);

		if (!checked) {
			removeStoredSavedBookingInfo();
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

	const handleDevErrorTrigger = (code: BookDevErrorCode) => {
		if (code === "GOOGLE_CALENDAR_AVAILABILITY_FAILED") {
			const errorMessage = getBookingErrorMessage({ data: { code } });
			setAvailabilityError(errorMessage);
			toast.error(errorMessage);
			return;
		}

		if (code === "UNKNOWN") {
			toast.error(getBookingErrorMessage(new Error("Something went wrong.")));
			return;
		}

		toast.error(getBookingErrorMessage({ data: { code } }));
	};

	return (
		<main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-4 pb-12">
			<div className="space-y-3">
				<h1 className="text-center font-brand text-[2.5rem] leading-none uppercase md:text-6xl">
					{pageCopy.title}
				</h1>
				<BookingRecurringSessionsPrompt />
			</div>
			{import.meta.env.DEV ? <BookDevErrorPanel onTriggerError={handleDevErrorTrigger} /> : null}
			{savedBookingInfo ? (
				<BookingSavedInfoBanner
					onRemove={handleRemoveSavedBookingInfo}
					onReuse={handleReuseSavedBookingInfo}
				/>
			) : null}

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
									toast.error(getBookingErrorMessage(submissionError));
								}
							});
					}}
					className="flex flex-col gap-10">
					<FieldGroup className="flex flex-col gap-8 md:gap-12">
						<BookingRecordingSpaceDurationSection />
						<BookingAddonsSection />
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
						<BookingContactSection />
					</FieldGroup>

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
							className="h-12 w-full rounded-lg text-base font-bold! tracking-wider shadow-lg shadow-primary/45"
							disabled={isSubmitting}>
							COMPLETE BOOKING
						</Button>
					</div>
				</form>
			</bookingFormContext.Provider>

			{showScrollToCompleteBooking ? (
				<div className="fixed right-4 bottom-16 z-50 animate-in fade-in zoom-in-150 duration-200 sm:right-6 sm:bottom-6 motion-reduce:zoom-in-100">
					<Button
						type="button"
						size="icon-lg"
						aria-label={
							isDateTimeIncomplete
								? "Scroll to date and time section"
								: "Scroll to complete booking"
						}
						className="rounded-full shadow-md active:scale-95 motion-reduce:transition-none"
						onClick={handleScrollToCompleteBooking}>
						<ChevronDown className="size-6" />
					</Button>
				</div>
			) : null}

			<TermsDialog
				open={showTermsDialog}
				isSubmitting={isSubmitting}
				onConfirm={handleTermsConfirm}
				onOpenChange={setShowTermsDialog}
			/>

			{checkoutSession ? (
				<Suspense fallback={null}>
					<BookingPaymentModal
						clientSecret={checkoutSession.clientSecret}
						onClose={handlePaymentModalClose}
					/>
				</Suspense>
			) : null}
		</main>
	);
}
