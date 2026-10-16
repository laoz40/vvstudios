import { useReducer, useRef, type RefObject } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { loadBookingPaymentModal } from "#studio/features/booking-form/components/BookingModalHost";
import {
	packageFormSchema,
	publicBookingSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";
import {
	openPaymentModal,
	openTermsModal
} from "#studio/features/booking-form/lib/booking-modal-store";
import {
	createPackageToastMessages,
	startCheckoutToastMessages
} from "#studio/features/booking-form/lib/booking-page-errors";
import { tryCatch } from "#/lib/result";
import {
	initialBookingCheckoutState,
	reduceBookingCheckout,
	type BookingCheckoutEvent
} from "#studio/features/booking-form/lib/booking-checkout-machine";

type CreateEmbeddedCheckoutSessionAction = ReturnType<
	typeof useAction<typeof api.stripe.checkout.createEmbeddedCheckoutSession>
>;

type CreatePackageCheckoutSessionAction = ReturnType<
	typeof useAction<typeof api.packages.payment.createPackageCheckoutSession>
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
	const [checkoutState, reactDispatch] = useReducer(
		reduceBookingCheckout,
		initialBookingCheckoutState
	);

	const checkout = useRef(initialBookingCheckoutState);

	function dispatch(event: BookingCheckoutEvent) {
		// Update checkout now so the form submission below sees that terms were accepted.
		// React updates the displayed state on its next render.
		checkout.current = reduceBookingCheckout(checkout.current, event);
		reactDispatch(event);
	}

	const submitPackageBooking = async (parsedValue: BookingFormValues) => {
		const packageFormValue = packageFormSchema.parse(parsedValue);

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
		if (checkout.current.kind === "creatingCheckout") {
			return;
		}

		const parsedValue = publicBookingSchema.parse(value);

		if (checkout.current.kind !== "validatingForm") {
			openTermsModal();
			void loadBookingPaymentModal();
			throw termsDialogPendingError;
		}

		dispatch({ type: "formValidated" });

		try {
			if (parsedValue.bookingMode === "package") {
				await submitPackageBooking(parsedValue);

				return;
			}

			await submitSingleBooking(parsedValue);
		} finally {
			dispatch({ type: "checkoutFinished" });
		}
	};

	const handleTermsConfirm = () => {
		if (checkout.current.kind !== "requiresTerms") {
			return;
		}

		dispatch({ type: "termsConfirmed" });
		formRef.current?.requestSubmit();
	};

	const resetTermsSubmit = () => {
		dispatch({ type: "formInvalid" });
	};

	return {
		handleSubmit,
		handleTermsConfirm,
		isSubmitting: checkoutState.kind === "creatingCheckout",
		resetTermsSubmit
	};
}
