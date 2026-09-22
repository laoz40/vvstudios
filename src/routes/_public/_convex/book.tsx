import { useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { toast } from "sonner";
import {
	BookDevErrorPanel,
	type BookDevErrorCode
} from "#studio/components/booking/BookDevErrorPanel";
import { Label } from "#/components/ui/label";
import { BookingModeSection } from "#studio/features/booking-form/components/BookingModeSection";
import { BookingPackageSection } from "#studio/features/booking-form/components/BookingPackageSection";
import { BookingContactSection } from "#studio/features/booking-form/components/BookingContactSection";
import { BookingRecordingSpaceDurationSection } from "#studio/features/booking-form/components/BookingRecordingSpaceDurationSection.tsx";
import { BookingAddonsSection } from "#studio/features/booking-form/components/BookingAddonsSection.tsx";
import { BookingModalHost } from "#studio/features/booking-form/components/BookingModalHost";
import { BookingSavedInfoBanner } from "#studio/features/booking-form/components/BookingSavedInfoBanner";
import { BookingSingleSessionScheduling } from "#studio/features/booking-form/components/BookingSingleSessionScheduling";
import { BookingSummary } from "#studio/features/booking-form/components/BookingSummary";
import {
	BookingFormContext,
	type BookingFormApi
} from "#studio/features/booking-form/lib/booking-form-context";
import {
	INITIAL_FORM,
	publicBookingSchema
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	termsDialogPendingError,
	useBookingSubmit
} from "#studio/features/booking-form/hooks/useBookingSubmit";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { Field, FieldContent, FieldGroup } from "#/components/ui/field";
import { api } from "#convex/_generated/api";
import { devBookingErrorMessages } from "#studio/features/booking-form/lib/booking-page-errors";
import { buildSeoHead, seoMetadata } from "#/lib/seo";
import { useBookingCheckoutClose } from "#studio/features/booking-form/hooks/useBookingCheckoutClose";
import { useSavedBookingInfo } from "#studio/features/booking-form/hooks/useSavedBookingInfo";
import { scrollToFirstBookingFormError } from "#studio/features/booking-form/lib/form-error-scroll";
import { cn } from "#/lib/utils";
import { landingSectionHeadingClassName } from "#studio/lib/landing-styles";

export const Route = createFileRoute("/_public/_convex/book")({
	head: () => buildSeoHead(seoMetadata.book),
	component: BookingPage
});

function BookingPage() {
	// Convex actions
	const createEmbeddedCheckoutSession = useAction(api.stripe.createEmbeddedCheckoutSession);
	const createPackageCheckoutSession = useAction(api.packagePayment.createPackageCheckoutSession);
	const { handlePaymentModalClose } = useBookingCheckoutClose();

	// Form and scroll targets
	const formRef = useRef<HTMLFormElement>(null);
	const showScrollToCompleteBookingRef = useRef<(() => void) | null>(null);
	const setAvailabilityErrorRef = useRef<((message: string) => void) | null>(null);
	const completeBookingButtonRef = useRef<HTMLDivElement>(null);

	const formApi: BookingFormApi = useForm({
		defaultValues: INITIAL_FORM,
		validators: { onSubmit: publicBookingSchema },
		onSubmit: async ({ value }) => {
			await bookingSubmit.handleSubmit(value);
		}
	});

	const savedBookingInfo = useSavedBookingInfo({
		formApi,
		onReuseSavedBookingInfo: () => showScrollToCompleteBookingRef.current?.()
	});

	const bookingSubmit = useBookingSubmit({
		createEmbeddedCheckoutSession,
		createPackageCheckoutSession,
		formRef,
		persistBookingInfoFromForm: savedBookingInfo.persistBookingInfoFromForm
	});

	const handleDevErrorTrigger = (code: BookDevErrorCode) => {
		const errorMessage = devBookingErrorMessages[code];

		if (code === "GOOGLE_CALENDAR_AVAILABILITY_FAILED") {
			setAvailabilityErrorRef.current?.(errorMessage);
		}

		toast.error(errorMessage);
	};

	return (
		<main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-8 px-4 pt-8 pb-12 sm:pt-10">
			<div>
				<h1 className={cn(landingSectionHeadingClassName, "text-center")}>Studio Hire Booking</h1>
			</div>
			{import.meta.env.DEV ? <BookDevErrorPanel onTriggerError={handleDevErrorTrigger} /> : null}
			{savedBookingInfo.savedBookingInfo ? (
				<BookingSavedInfoBanner
					onRemove={savedBookingInfo.handleRemoveSavedBookingInfo}
					onReuse={savedBookingInfo.handleReuseSavedBookingInfo}
				/>
			) : null}

			<BookingFormContext value={formApi}>
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
							<BookingPackageSection />
						</div>
						<BookingRecordingSpaceDurationSection />
						<BookingAddonsSection />
						<BookingSingleSessionScheduling
							completeBookingTargetRef={completeBookingButtonRef}
							setAvailabilityErrorRef={setAvailabilityErrorRef}
							showScrollToCompleteBookingRef={showScrollToCompleteBookingRef}
						/>
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
						ref={completeBookingButtonRef}
						className="space-y-12">
						<BookingSummary />
						<Button
							type="submit"
							className="mb-20 h-12 w-full rounded-lg text-base font-bold! tracking-wider shadow-lg shadow-primary/45"
							disabled={bookingSubmit.isSubmitting}>
							{bookingSubmit.isSubmitting ? "PROCESSING" : "COMPLETE BOOKING"}
						</Button>
					</div>
				</form>
			</BookingFormContext>
			<BookingModalHost
				isSubmitting={bookingSubmit.isSubmitting}
				onPaymentClose={handlePaymentModalClose}
				onTermsConfirm={bookingSubmit.handleTermsConfirm}
			/>
		</main>
	);
}
