import { useRef, useState, type RefObject } from "react";
import { useAction } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { studioSite } from "#/config/sites";
import { loadBookingPaymentModal } from "#studio/features/booking-form/components/BookingModalHost";
import {
	packageFormSchema,
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
	createPackageToastMessages,
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
	const [hasCompletedPackageBooking, setHasCompletedPackageBooking] = useState(false);
	const isSubmittingRef = useRef(false);
	const submitAfterTermsRef = useRef(false);
	const navigate = useNavigate();

	const submitPackageBooking = async (parsedValue: BookingFormValues) => {
		const packageFormValue = packageFormSchema.parse(parsedValue);

		isSubmittingRef.current = true;
		setIsSubmitting(true);
		const addonQuantities = pickBookingAddonQuantities(packageFormValue);

		const [error, result] = await tryCatch(
			createPackageRequest({
				name: packageFormValue.name,
				phone: packageFormValue.phone,
				accountName: packageFormValue.accountName,
				abn: packageFormValue.abn || undefined,
				email: packageFormValue.email,
				duration: packageFormValue.duration,
				addons: packageFormValue.addons,
				essentialEditQuantity: addonQuantities.essentialEditQuantity || undefined,
				completeEditQuantity: addonQuantities.completeEditQuantity || undefined,
				clipsPackageQuantity: addonQuantities.clipsPackageQuantity || undefined,
				handcraftedClipsQuantity: addonQuantities.handcraftedClipsQuantity || undefined,
				notes: packageFormValue.notes,
				packageSize: packageFormValue.packageSize
			})
		);
		isSubmittingRef.current = false;
		setIsSubmitting(false);

		if (error !== null) {
			toast.error(createPackageToastMessages[error.reason]);
			return;
		}

		persistBookingInfoFromForm({ ...parsedValue, notes: "" });
		setHasCompletedPackageBooking(true);
		closeBookingModal();
		await navigate({
			to: studioSite.routes.packageComplete,
			search: { package_id: result.packageId, package_size: packageFormValue.packageSize }
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
		if (isSubmittingRef.current || hasCompletedPackageBooking) {
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

		if (parsedValue.bookingMode === "package") {
			await submitPackageBooking(parsedValue);
			return;
		}

		await submitSingleBooking(parsedValue);
	};

	const handleTermsConfirm = () => {
		if (isSubmittingRef.current || submitAfterTermsRef.current || hasCompletedPackageBooking) {
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
		hasCompletedPackageBooking,
		isSubmitting,
		resetTermsSubmit
	};
}
