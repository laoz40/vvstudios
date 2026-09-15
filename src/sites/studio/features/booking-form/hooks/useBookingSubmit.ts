import { useRef, useState, type RefObject } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { loadBookingPaymentModal } from "#studio/features/booking-form/components/BookingModalHost";
import {
	packageFormSchema,
	pickBookingAddonQuantities,
	publicBookingSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
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

type CreatePackageCheckoutSessionAction = ReturnType<
	typeof useAction<typeof api.packagePayment.createPackageCheckoutSession>
>;

interface UseBookingSubmitOptions {
	createEmbeddedCheckoutSession: CreateEmbeddedCheckoutSessionAction;
	createPackageCheckoutSession: CreatePackageCheckoutSessionAction;
	formRef: RefObject<HTMLFormElement | null>;
	persistBookingInfoFromForm: (values: BookingFormValues) => void;
}

export const termsDialogPendingError = new Error("terms-dialog-pending");

export function useBookingSubmit({
	createEmbeddedCheckoutSession,
	createPackageCheckoutSession,
	formRef,
	persistBookingInfoFromForm
}: UseBookingSubmitOptions) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const isSubmittingRef = useRef(false);
	const submitAfterTermsRef = useRef(false);

	const submitPackageBooking = async (parsedValue: BookingFormValues) => {
		const packageFormValue = packageFormSchema.parse(parsedValue);

		isSubmittingRef.current = true;
		setIsSubmitting(true);
		const addonQuantities = pickBookingAddonQuantities(packageFormValue);

		const [error, session] = await tryCatch(
			createPackageCheckoutSession({
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
		submitAfterTermsRef.current = false;

		if (error !== null) {
			toast.error(createPackageToastMessages[error.reason]);

			return;
		}

		persistBookingInfoFromForm({ ...parsedValue, notes: "" });
		openPaymentModal({
			kind: "package",
			packageId: session.packageId,
			clientSecret: session.clientSecret,
			stripeSessionId: session.stripeSessionId
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
		openPaymentModal({
			kind: "session",
			bookingId: session.bookingId,
			clientSecret: session.clientSecret,
			stripeSessionId: session.stripeSessionId
		});
	};

	const handleSubmit = async (value: BookingFormValues) => {
		if (isSubmittingRef.current) {
			return;
		}

		const parsedValue = publicBookingSchema.parse(value);

		if (!submitAfterTermsRef.current) {
			openTermsModal();
			void loadBookingPaymentModal();
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
		if (isSubmittingRef.current || submitAfterTermsRef.current) {
			return;
		}

		submitAfterTermsRef.current = true;
		formRef.current?.requestSubmit();
	};

	const resetTermsSubmit = () => {
		submitAfterTermsRef.current = false;
	};

	return { handleSubmit, handleTermsConfirm, isSubmitting, resetTermsSubmit };
}
