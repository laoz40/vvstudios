import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "@tanstack/react-store";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type {
	CloseEmbeddedCheckoutSessionResult,
	CreateEmbeddedCheckoutSessionResult
} from "#convex/stripe";
import {
	BookDevErrorPanel,
	type BookDevErrorCode
} from "#studio/components/booking/BookDevErrorPanel";
import { Label } from "#/components/ui/label";
import { BookingContactSection } from "#studio/features/booking-form/components/BookingContactSection";
import { BookingDateTimeSection } from "#studio/features/booking-form/components/BookingDateTimeSection.tsx";
import { BookingRecordingSpaceDurationSection } from "#studio/features/booking-form/components/BookingRecordingSpaceDurationSection.tsx";
import { BookingRecurringSessionsPrompt } from "#studio/features/booking-form/components/BookingRecurringSessionsPrompt";
import { BookingAddonsSection } from "#studio/features/booking-form/components/BookingAddonsSection.tsx";
import {
	BookingModalHost,
	loadBookingPaymentModal
} from "#studio/features/booking-form/components/BookingModalHost";
import { BookingSavedInfoBanner } from "#studio/features/booking-form/components/BookingSavedInfoBanner";
import { BookingSummary } from "#studio/features/booking-form/components/BookingSummary";
import {
	bookingFormContext,
	type BookingFormApi
} from "#studio/features/booking-form/lib/booking-form-context";
import { bookingSchema, INITIAL_FORM } from "#studio/features/booking-form/lib/form-shared";
import {
	getStoredSavedBookingInfo,
	removeStoredSavedBookingInfo,
	storeSavedBookingInfo,
	toSavedBookingInfo,
	type SavedBookingInfo
} from "#studio/features/booking-form/lib/saved-booking-info";
import {
	openPaymentModal,
	openTermsModal
} from "#studio/features/booking-form/lib/booking-modal-store";
import type { EmbeddedCheckoutSession } from "#studio/features/booking-form/lib/checkout-session";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Field, FieldContent, FieldGroup } from "#/components/ui/field";
import { getCurrentMonthKey, parseMonthKey } from "#studio/lib/bookingdatetime";
import { api } from "#convex/_generated/api";
import {
	closeCheckoutToastMessages,
	devBookingErrorMessages,
	startCheckoutToastMessages
} from "#studio/features/booking-form/lib/booking-page-errors";
import { useBookingAvailability } from "#studio/features/booking-form/lib/use-booking-availability";
import { buildSeoHead, seoMetadata } from "#/lib/seo";
import { tryCatch } from "#/lib/result";

type CreateEmbeddedCheckoutSessionAction = ReturnType<
	typeof useAction<typeof api.stripe.createEmbeddedCheckoutSession>
>;
type CloseEmbeddedCheckoutSessionAction = ReturnType<
	typeof useAction<typeof api.stripe.closeEmbeddedCheckoutSession>
>;

const termsDialogPendingError = new Error("terms-dialog-pending");

export const Route = createFileRoute("/_public/book")({
	head: () => buildSeoHead(seoMetadata.book),
	component: BookingPage
});

const pageCopy = { title: "Studio Hire Booking" } as const;

function BookingPage() {
	// Convex actions
	const createEmbeddedCheckoutSession: CreateEmbeddedCheckoutSessionAction = useAction(
		api.stripe.createEmbeddedCheckoutSession
	);
	const closeEmbeddedCheckoutSession: CloseEmbeddedCheckoutSessionAction = useAction(
		api.stripe.closeEmbeddedCheckoutSession
	);

	// Form and scroll targets
	const formRef = useRef<HTMLFormElement>(null);
	const dateTimeSectionRef = useRef<HTMLDivElement>(null);
	const completeBookingButtonRef = useRef<HTMLDivElement>(null);

	// Submission flow
	const [isSubmitting, setIsSubmitting] = useState(false);
	const submitAfterTermsRef = useRef(false);

	// Saved booking details
	const [savedBookingInfo, setSavedBookingInfo] = useState<SavedBookingInfo | null>(null);
	const [shouldSaveBookingInfo, setShouldSaveBookingInfo] = useState(false);

	// Complete booking shortcut
	const [showScrollToCompleteBooking, setShowScrollToCompleteBooking] = useState(false);
	const [hasReachedCompleteBooking, setHasReachedCompleteBooking] = useState(false);

	// Booking availability
	const resetAvailabilityCalendarRef = useRef<() => void>(() => {});

	const formApi = useForm({
		defaultValues: INITIAL_FORM,
		validators: { onBlur: bookingSchema, onSubmit: bookingSchema },
		onSubmit: async ({ value }) => {
			const parsedValue = bookingSchema.parse(value);

			if (!submitAfterTermsRef.current) {
				openTermsModal();
				void loadBookingPaymentModal();
				throw termsDialogPendingError;
			}

			submitAfterTermsRef.current = false;
			setIsSubmitting(true);

			try {
				const [error, session] = await tryCatch<CreateEmbeddedCheckoutSessionResult>(
					createEmbeddedCheckoutSession({
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
						essentialEditQuantity: parsedValue.essentialEditQuantity || undefined,
						clipsPackageQuantity: parsedValue.clipsPackageQuantity || undefined,
						notes: parsedValue.notes
					})
				);

				if (error !== null) {
					toast.error(startCheckoutToastMessages[error.reason]);
					return;
				}

				if (shouldSaveBookingInfo) {
					const nextSavedBookingInfo = toSavedBookingInfo(parsedValue);
					storeSavedBookingInfo(nextSavedBookingInfo);
					setSavedBookingInfo(nextSavedBookingInfo);
				} else {
					removeStoredSavedBookingInfo();
					setSavedBookingInfo(null);
				}

				openPaymentModal(session);

				resetAvailabilityCalendarRef.current();
			} finally {
				setIsSubmitting(false);
				submitAfterTermsRef.current = false;
			}
		}
	});
	const formValues = useSelector(formApi.store, (state) => state.values);
	const isDateTimeIncomplete = !formValues.date || !formValues.time;
	const handleSelectedTimeInvalidated = useCallback(() => {
		formApi.setFieldValue("time", "");
	}, [formApi]);
	const availability = useBookingAvailability({
		date: formValues.date,
		duration: formValues.duration,
		onSelectedTimeInvalidated: handleSelectedTimeInvalidated,
		selectedTime: formValues.time
	});
	resetAvailabilityCalendarRef.current = () => {
		availability.setCalendarMonth(parseMonthKey(getCurrentMonthKey()));
	};

	// load saved booking info
	useEffect(() => {
		const nextSavedBookingInfo = getStoredSavedBookingInfo();

		if (!nextSavedBookingInfo) {
			removeStoredSavedBookingInfo();
			return;
		}

		setSavedBookingInfo(nextSavedBookingInfo);
		setShouldSaveBookingInfo(true);
	}, []);

	// hide complete booking shortcut once its target is visible
	useEffect(() => {
		const updateHasReachedCompleteBooking = () => {
			const completeBookingButton = completeBookingButtonRef.current;

			if (!completeBookingButton) {
				setHasReachedCompleteBooking(false);
				return;
			}

			setHasReachedCompleteBooking(
				completeBookingButton.getBoundingClientRect().top <= window.innerHeight
			);
		};

		updateHasReachedCompleteBooking();
		window.addEventListener("scroll", updateHasReachedCompleteBooking, { passive: true });
		window.addEventListener("resize", updateHasReachedCompleteBooking);

		return () => {
			window.removeEventListener("scroll", updateHasReachedCompleteBooking);
			window.removeEventListener("resize", updateHasReachedCompleteBooking);
		};
	}, []);

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
				"notes"
			];

			for (const fieldName of fieldOrder) {
				const fieldContainer = formRef.current?.querySelector<HTMLElement>(
					`[data-field-name="${fieldName}"]`
				);
				const fieldError = fieldContainer?.querySelector<HTMLElement>('[data-slot="field-error"]');

				if (fieldContainer && fieldError) {
					fieldContainer.scrollIntoView({ behavior: "smooth", block: "center" });
					return;
				}
			}
		});
	};

	const handlePaymentModalClose = (activeCheckoutSession: EmbeddedCheckoutSession) => {
		void closeOpenCheckoutSession(activeCheckoutSession);
	};

	const closeOpenCheckoutSession = async (activeCheckoutSession: EmbeddedCheckoutSession) => {
		const [error] = await tryCatch<CloseEmbeddedCheckoutSessionResult>(
			closeEmbeddedCheckoutSession({
				bookingId: activeCheckoutSession.bookingId,
				stripeSessionId: activeCheckoutSession.stripeSessionId
			})
		);

		if (error !== null) {
			toast.error(closeCheckoutToastMessages[error.reason]);
			return;
		}
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
		formApi.setFieldValue("essentialEditQuantity", savedBookingInfo.essentialEditQuantity);
		formApi.setFieldValue("clipsPackageQuantity", savedBookingInfo.clipsPackageQuantity);
		formApi.setFieldValue("name", savedBookingInfo.name);
		formApi.setFieldValue("phone", savedBookingInfo.phone);
		formApi.setFieldValue("accountName", savedBookingInfo.accountName);
		formApi.setFieldValue("abn", savedBookingInfo.abn);
		formApi.setFieldValue("email", savedBookingInfo.email);
		formApi.setFieldValue("notes", savedBookingInfo.notes);
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
			block: isDateTimeIncomplete ? "start" : "center"
		});
	};

	const handleDevErrorTrigger = (code: BookDevErrorCode) => {
		const errorMessage = devBookingErrorMessages[code];

		if (code === "GOOGLE_CALENDAR_AVAILABILITY_FAILED") {
			availability.setAvailabilityError(errorMessage);
		}

		toast.error(errorMessage);
	};

	return (
		<main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-4 pt-8 pb-12 sm:pt-10">
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
									const message =
										submissionError instanceof Error
											? submissionError.message
											: "Something went wrong.";
									toast.error(message);
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
							<BookingDateTimeSection availability={availability} />
						</div>
						<BookingContactSection />
					</FieldGroup>

					<Field
						orientation="horizontal"
						className="items-center! gap-2">
						<Checkbox
							id="save-booking-info"
							checked={shouldSaveBookingInfo}
							className="size-5 rounded-full data-[state=checked]:border-transparent"
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

					<div
						ref={completeBookingButtonRef}
						className="space-y-4">
						<BookingSummary values={formValues} />
						<Button
							type="submit"
							className="mb-20 h-12 w-full rounded-lg text-base font-bold! tracking-wider shadow-lg shadow-primary/45"
							disabled={isSubmitting}>
							COMPLETE BOOKING
						</Button>
					</div>
				</form>
			</bookingFormContext.Provider>
			<BookingModalHost
				isSubmitting={isSubmitting}
				onPaymentClose={handlePaymentModalClose}
				onTermsConfirm={handleTermsConfirm}
			/>

			{showScrollToCompleteBooking && !hasReachedCompleteBooking ? (
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
		</main>
	);
}
