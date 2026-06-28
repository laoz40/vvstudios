import { useCallback, useRef } from "react";
import { useSelector } from "@tanstack/react-store";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
	BookDevErrorPanel,
	type BookDevErrorCode
} from "#studio/components/booking/BookDevErrorPanel";
import { Label } from "#/components/ui/label";
import { BookingModeSection } from "#studio/features/booking-form/components/BookingModeSection";
import { BookingMultiBookingPackageSection } from "#studio/features/booking-form/components/BookingMultiBookingPackageSection";
import { BookingContactSection } from "#studio/features/booking-form/components/BookingContactSection";
import { BookingDateTimeSection } from "#studio/features/booking-form/components/BookingDateTimeSection.tsx";
import { BookingRecordingSpaceDurationSection } from "#studio/features/booking-form/components/BookingRecordingSpaceDurationSection.tsx";
import { BookingAddonsSection } from "#studio/features/booking-form/components/BookingAddonsSection.tsx";
import { BookingModalHost } from "#studio/features/booking-form/components/BookingModalHost";
import { BookingSavedInfoBanner } from "#studio/features/booking-form/components/BookingSavedInfoBanner";
import { BookingSummary } from "#studio/features/booking-form/components/BookingSummary";
import {
	bookingFormContext,
	type BookingFormApi
} from "#studio/features/booking-form/lib/booking-form-context";
import { bookingSchema, INITIAL_FORM } from "#studio/features/booking-form/lib/booking-form-model";
import {
	termsDialogPendingError,
	useBookingSubmit
} from "#studio/features/booking-form/hooks/useBookingSubmit";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Field, FieldContent, FieldGroup } from "#/components/ui/field";
import { api } from "#convex/_generated/api";
import { devBookingErrorMessages } from "#studio/features/booking-form/lib/booking-page-errors";
import { useBookingAvailability } from "#studio/features/booking-form/hooks/useBookingAvailability";
import { buildSeoHead, seoMetadata } from "#/lib/seo";
import { useBookingCheckoutClose } from "#studio/features/booking-form/hooks/useBookingCheckoutClose";
import { useCompleteBookingShortcut } from "#studio/features/booking-form/hooks/useCompleteBookingShortcut";
import { useSavedBookingInfo } from "#studio/features/booking-form/hooks/useSavedBookingInfo";
import { scrollToFirstBookingFormError } from "#studio/features/booking-form/lib/form-error-scroll";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/_public/book")({
	head: () => buildSeoHead(seoMetadata.book),
	component: BookingPage
});

function BookingPage() {
	// Convex actions
	const createEmbeddedCheckoutSession = useAction(api.stripe.createEmbeddedCheckoutSession);
	const createMultiBookingRequest = useAction(api.multiBookings.createMultiBookingRequest);
	const { handlePaymentModalClose } = useBookingCheckoutClose();

	// Form and scroll targets
	const formRef = useRef<HTMLFormElement>(null);

	const formApi = useForm({
		defaultValues: INITIAL_FORM,
		validators: { onBlur: bookingSchema, onSubmit: bookingSchema },
		onSubmit: async ({ value }) => {
			await bookingSubmit.handleSubmit(value);
		}
	});

	// Derived form values and availability
	const formValues = useSelector(formApi.store, (state) => state.values);
	const isDateTimeIncomplete =
		formValues.bookingMode === "single" && (!formValues.date || !formValues.time);
	const handleSelectedTimeInvalidated = useCallback(() => {
		formApi.setFieldValue("time", "");
	}, [formApi]);

	const availability = useBookingAvailability({
		date: formValues.date,
		duration: formValues.duration,
		onSelectedTimeInvalidated: handleSelectedTimeInvalidated,
		selectedTime: formValues.time
	});
	const completeBookingShortcut = useCompleteBookingShortcut(isDateTimeIncomplete);

	const savedBookingInfo = useSavedBookingInfo({
		formApi: formApi as unknown as BookingFormApi,
		onReuseSavedBookingInfo: () => completeBookingShortcut.setShowScrollToCompleteBooking(true)
	});

	const bookingSubmit = useBookingSubmit({
		createEmbeddedCheckoutSession,
		createMultiBookingRequest,
		formRef,
		persistBookingInfoFromForm: savedBookingInfo.persistBookingInfoFromForm
	});

	const handleDevErrorTrigger = (code: BookDevErrorCode) => {
		const errorMessage = devBookingErrorMessages[code];

		if (code === "GOOGLE_CALENDAR_AVAILABILITY_FAILED") {
			availability.setAvailabilityError(errorMessage);
		}

		toast.error(errorMessage);
	};

	return (
		<main
			className={cn("mx-auto flex min-h-dvh max-w-4xl flex-col", "gap-8 px-4 pt-8 pb-12 sm:pt-10")}>
			<div>
				<h1 className="text-center font-brand text-[2.5rem] leading-none uppercase md:text-6xl">
					Studio Hire Booking
				</h1>
			</div>
			{import.meta.env.DEV ? <BookDevErrorPanel onTriggerError={handleDevErrorTrigger} /> : null}
			{savedBookingInfo.savedBookingInfo ? (
				<BookingSavedInfoBanner
					onRemove={savedBookingInfo.handleRemoveSavedBookingInfo}
					onReuse={savedBookingInfo.handleReuseSavedBookingInfo}
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
									bookingSubmit.resetTermsSubmit();
									scrollToFirstBookingFormError(formRef);
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
						<div>
							<BookingModeSection />
							<BookingMultiBookingPackageSection />
						</div>
						<BookingRecordingSpaceDurationSection />
						<BookingAddonsSection />
						{formValues.bookingMode === "single" ? (
							<div
								ref={completeBookingShortcut.dateTimeSectionRef}
								className="scroll-mt-32 sm:scroll-mt-40">
								<BookingDateTimeSection availability={availability} />
							</div>
						) : null}
						<BookingContactSection />
					</FieldGroup>

					<Field
						orientation="horizontal"
						className="items-center! gap-2">
						<Checkbox
							id="save-booking-info"
							checked={savedBookingInfo.shouldSaveBookingInfo}
							className="size-5 rounded-full data-[state=checked]:border-transparent"
							onCheckedChange={(checked) =>
								savedBookingInfo.handleSaveBookingInfoChange(checked === true)
							}
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
						ref={completeBookingShortcut.completeBookingButtonRef}
						className="space-y-4">
						<BookingSummary />
						<Button
							type="submit"
							className={cn(
								"mb-20 h-12 w-full rounded-lg",
								"text-base font-bold! tracking-wider",
								"shadow-lg shadow-primary/45"
							)}
							disabled={bookingSubmit.isSubmitting}>
							COMPLETE BOOKING
						</Button>
					</div>
				</form>
			</bookingFormContext.Provider>
			<BookingModalHost
				isSubmitting={bookingSubmit.isSubmitting}
				onPaymentClose={handlePaymentModalClose}
				onTermsConfirm={bookingSubmit.handleTermsConfirm}
			/>

			{completeBookingShortcut.showScrollToCompleteBooking &&
			!completeBookingShortcut.hasReachedCompleteBooking ? (
				<div
					className={cn(
						"fixed right-4 bottom-16 z-50 sm:right-6 sm:bottom-6",
						"animate-in fade-in zoom-in-150 duration-200 motion-reduce:zoom-in-100"
					)}>
					<Button
						type="button"
						size="icon-lg"
						aria-label={
							isDateTimeIncomplete
								? "Scroll to date and time section"
								: "Scroll to complete booking"
						}
						className="rounded-full shadow-md active:scale-95 motion-reduce:transition-none"
						onClick={completeBookingShortcut.handleScrollToCompleteBooking}>
						<ChevronDown className="size-6" />
					</Button>
				</div>
			) : null}
		</main>
	);
}
