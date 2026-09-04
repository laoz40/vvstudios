import { useRef, useState, type RefObject } from "react";
import { useAction } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { studioSite } from "#/config/sites";
import { loadBookingPaymentModal } from "#studio/features/booking-form/components/BookingModalHost";
import {
	multiBookingFormSchema,
	pickBookingAddonQuantities,
	publicBookingSchema,
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
type CreatePackageRequestAction = ReturnType<
	typeof useAction<typeof api.packagePayment.createPackageRequest>
>;

interface UseBookingSubmitOptions {
	createEmbeddedCheckoutSession: CreateEmbeddedCheckoutSessionAction;
	createPackageRequest: CreatePackageRequestAction;
	formRef: RefObject<HTMLFormElement | null>;
	persistBookingInfoFromForm: (values: BookingFormValues) => void;
}

export const termsDialogPendingError = new Error("terms-dialog-pending");

export function useBookingSubmit({
	createEmbeddedCheckoutSession,
	createPackageRequest,
	formRef,
	persistBookingInfoFromForm
}: UseBookingSubmitOptions) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [hasCompletedMultiBooking, setHasCompletedMultiBooking] = useState(false);
	const isSubmittingRef = useRef(false);
	const submitAfterTermsRef = useRef(false);
	const navigate = useNavigate();

	const submitMultiBooking = async (parsedValue: BookingFormValues) => {
		const multiBookingValue = multiBookingFormSchema.parse(parsedValue);

		isSubmittingRef.current = true;
		setIsSubmitting(true);
		const addonQuantities = pickBookingAddonQuantities(multiBookingValue);

		const [error, result] = await tryCatch(
			createPackageRequest({
				name: multiBookingValue.name,
				phone: multiBookingValue.phone,
				accountName: multiBookingValue.accountName,
				abn: multiBookingValue.abn || undefined,
				email: multiBookingValue.email,
				duration: multiBookingValue.duration,
				addons: multiBookingValue.addons,
				essentialEditQuantity: addonQuantities.essentialEditQuantity || undefined,
				completeEditQuantity: addonQuantities.completeEditQuantity || undefined,
				clipsPackageQuantity: addonQuantities.clipsPackageQuantity || undefined,
				handcraftedClipsQuantity: addonQuantities.handcraftedClipsQuantity || undefined,
				notes: multiBookingValue.notes,
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
	};

	const submitSingleBooking = async (parsedValue: BookingFormValues) => {
		isSubmittingRef.current = true;
		setIsSubmitting(true);
		const addonQuantities = pickBookingAddonQuantities(parsedValue);

		const [error, session] = await tryCatch(
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
				essentialEditQuantity: addonQuantities.essentialEditQuantity || undefined,
				completeEditQuantity: addonQuantities.completeEditQuantity || undefined,
				clipsPackageQuantity: addonQuantities.clipsPackageQuantity || undefined,
				handcraftedClipsQuantity: addonQuantities.handcraftedClipsQuantity || undefined,
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

	const handleSubmit = async (value: BookingFormValues) => {
		if (isSubmittingRef.current || hasCompletedMultiBooking) {
			return;
		}

		const parsedValue = publicBookingSchema.parse(value);

		if (!submitAfterTermsRef.current) {
			openTermsModal();

			if (parsedValue.bookingMode === "single") {
				void loadBookingPaymentModal();
			}

			throw termsDialogPendingError;
		}

		submitAfterTermsRef.current = false;

		if (parsedValue.bookingMode === "multi") {
			await submitMultiBooking(parsedValue);
			return;
		}

		await submitSingleBooking(parsedValue);
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
