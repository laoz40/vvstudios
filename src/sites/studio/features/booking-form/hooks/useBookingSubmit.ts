import { useRef, useState, type RefObject } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import type { CreateEmbeddedCheckoutSessionResult } from "#convex/stripe";
import { api } from "#convex/_generated/api";
import { loadBookingPaymentModal } from "#studio/features/booking-form/components/BookingModalHost";
import {
	bookingSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/form-shared";
import {
	openPaymentModal,
	openTermsModal
} from "#studio/features/booking-form/lib/booking-modal-store";
import { startCheckoutToastMessages } from "#studio/features/booking-form/lib/booking-page-errors";
import { tryCatch } from "#/lib/result";

type CreateEmbeddedCheckoutSessionAction = ReturnType<
	typeof useAction<typeof api.stripe.createEmbeddedCheckoutSession>
>;

interface UseBookingSubmitOptions {
	createEmbeddedCheckoutSession: CreateEmbeddedCheckoutSessionAction;
	formRef: RefObject<HTMLFormElement | null>;
	persistBookingInfoFromForm: (values: BookingFormValues) => void;
}

export const termsDialogPendingError = new Error("terms-dialog-pending");

export function useBookingSubmit({
	createEmbeddedCheckoutSession,
	formRef,
	persistBookingInfoFromForm
}: UseBookingSubmitOptions) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const submitAfterTermsRef = useRef(false);

	const handleSubmit = async (value: BookingFormValues) => {
		const parsedValue = bookingSchema.parse(value);

		if (!submitAfterTermsRef.current) {
			openTermsModal();
			void loadBookingPaymentModal();
			throw termsDialogPendingError;
		}

		submitAfterTermsRef.current = false;
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
		submitAfterTermsRef.current = true;
		formRef.current?.requestSubmit();
	};

	const resetTermsSubmit = () => {
		submitAfterTermsRef.current = false;
	};

	return { handleSubmit, handleTermsConfirm, isSubmitting, resetTermsSubmit };
}
