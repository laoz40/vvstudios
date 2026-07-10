import { useRef, useState, type RefObject } from "react";
import { useAction } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type { CreateMultiBookingRequestResult } from "#convex/multiBookings";
import type { CreateEmbeddedCheckoutSessionResult } from "#convex/stripe";
import { api } from "#convex/_generated/api";
import { studioSite } from "#/config/sites";
import { loadBookingPaymentModal } from "#studio/features/booking-form/components/BookingModalHost";
import {
	bookingSchema,
	multiBookingFormSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	closeBookingModal,
	openPaymentModal,
	openTermsModal
} from "#studio/features/booking-form/lib/booking-modal-store";
import {
	createMultiBookingToastMessages,
	startCheckoutToastMessages
} from "#studio/features/booking-form/lib/booking-page-errors";
import { tryCatch } from "#/lib/result";

type CreateEmbeddedCheckoutSessionAction = ReturnType<
	typeof useAction<typeof api.stripe.createEmbeddedCheckoutSession>
>;
type CreateMultiBookingRequestAction = ReturnType<
	typeof useAction<typeof api.multiBookings.createMultiBookingRequest>
>;

interface UseBookingSubmitOptions {
	createEmbeddedCheckoutSession: CreateEmbeddedCheckoutSessionAction;
	createMultiBookingRequest: CreateMultiBookingRequestAction;
	formRef: RefObject<HTMLFormElement | null>;
	persistBookingInfoFromForm: (values: BookingFormValues) => void;
}

export const termsDialogPendingError = new Error("terms-dialog-pending");

export function useBookingSubmit({
	createEmbeddedCheckoutSession,
	createMultiBookingRequest,
	formRef,
	persistBookingInfoFromForm
}: UseBookingSubmitOptions) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [hasCompletedMultiBooking, setHasCompletedMultiBooking] = useState(false);
	const isSubmittingRef = useRef(false);
	const submitAfterTermsRef = useRef(false);
	const navigate = useNavigate();

	const handleSubmit = async (value: BookingFormValues) => {
		if (isSubmittingRef.current || hasCompletedMultiBooking) {
			return;
		}

		const parsedValue = bookingSchema.parse(value);

		if (!submitAfterTermsRef.current) {
			openTermsModal();

			if (parsedValue.bookingMode === "single") {
				void loadBookingPaymentModal();
			}

			throw termsDialogPendingError;
		}

		submitAfterTermsRef.current = false;

		if (parsedValue.bookingMode === "multi") {
			const multiBookingValue = multiBookingFormSchema.parse(parsedValue);

			isSubmittingRef.current = true;
			setIsSubmitting(true);

			const [error, result] = await tryCatch<CreateMultiBookingRequestResult>(
				createMultiBookingRequest({
					name: multiBookingValue.name,
					phone: multiBookingValue.phone,
					accountName: multiBookingValue.accountName,
					abn: multiBookingValue.abn || undefined,
					email: multiBookingValue.email,
					duration: multiBookingValue.duration,
					service: multiBookingValue.service,
					addons: multiBookingValue.addons,
					essentialEditQuantity: multiBookingValue.essentialEditQuantity || undefined,
					clipsPackageQuantity: multiBookingValue.clipsPackageQuantity || undefined,
					packageSize: multiBookingValue.packageSize
				})
			);
			isSubmittingRef.current = false;
			setIsSubmitting(false);

			if (error !== null) {
				toast.error(createMultiBookingToastMessages[error.reason]);
				return;
			}

			persistBookingInfoFromForm({ ...parsedValue, notes: "" });
			setHasCompletedMultiBooking(true);
			closeBookingModal();
			await navigate({
				to: studioSite.routes.packageComplete,
				search: {
					multi_booking_id: result.multiBookingId,
					package_size: multiBookingValue.packageSize
				}
			});
			return;
		}

		isSubmittingRef.current = true;
		setIsSubmitting(true);
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
		isSubmittingRef.current = false;
		setIsSubmitting(false);
		submitAfterTermsRef.current = false;

		if (error !== null) {
			toast.error(startCheckoutToastMessages[error.reason]);
			return;
		}

		persistBookingInfoFromForm(parsedValue);
		openPaymentModal(session);
	};

	const handleTermsConfirm = () => {
		if (isSubmittingRef.current || submitAfterTermsRef.current || hasCompletedMultiBooking) {
			return;
		}

		submitAfterTermsRef.current = true;
		formRef.current?.requestSubmit();
	};

	const resetTermsSubmit = () => {
		submitAfterTermsRef.current = false;
	};

	return {
		handleSubmit,
		handleTermsConfirm,
		hasCompletedMultiBooking,
		isSubmitting,
		resetTermsSubmit
	};
}
