/**
 * Booking checkout confirmation requirements.
 *
 * 1. Checkout requires terms confirmation
 *    A valid form cannot start checkout before the customer confirms the terms.
 *
 * 2. Invalid revalidation requires fresh confirmation
 *    A failed form recheck consumes the confirmation before another attempt.
 *
 * 3. An in-flight checkout cannot be repeated
 *    Repeated events do not start another checkout, and retrying after finish requires confirmation.
 */
import { expect, test } from "vitest";
import {
	initialBookingCheckoutState,
	reduceBookingCheckout
} from "#studio/features/booking-form/lib/booking-checkout-machine";

test("checkout requires terms confirmation", () => {
	const beforeConfirmation = reduceBookingCheckout(initialBookingCheckoutState, {
		type: "formValidated"
	});

	const awaitingValidation = reduceBookingCheckout(beforeConfirmation, { type: "termsConfirmed" });

	const creatingCheckout = reduceBookingCheckout(awaitingValidation, { type: "formValidated" });

	expect(beforeConfirmation).toEqual({ kind: "requiresTerms" });
	expect(awaitingValidation).toEqual({ kind: "validatingForm" });
	expect(creatingCheckout).toEqual({ kind: "creatingCheckout" });
});

test("invalid revalidation requires fresh terms confirmation", () => {
	const awaitingValidation = reduceBookingCheckout(initialBookingCheckoutState, {
		type: "termsConfirmed"
	});

	const invalidForm = reduceBookingCheckout(awaitingValidation, { type: "formInvalid" });

	const withoutFreshConfirmation = reduceBookingCheckout(invalidForm, { type: "formValidated" });

	const confirmedAgain = reduceBookingCheckout(withoutFreshConfirmation, {
		type: "termsConfirmed"
	});

	const creatingCheckout = reduceBookingCheckout(confirmedAgain, { type: "formValidated" });

	expect(invalidForm).toEqual({ kind: "requiresTerms" });
	expect(withoutFreshConfirmation).toEqual({ kind: "requiresTerms" });
	expect(creatingCheckout).toEqual({ kind: "creatingCheckout" });
});

test("checkout stays in flight until finished and retry requires confirmation", () => {
	const awaitingValidation = reduceBookingCheckout(initialBookingCheckoutState, {
		type: "termsConfirmed"
	});

	const creatingCheckout = reduceBookingCheckout(awaitingValidation, { type: "formValidated" });

	const afterRepeatedConfirmation = reduceBookingCheckout(creatingCheckout, {
		type: "termsConfirmed"
	});

	const afterRepeatedSubmission = reduceBookingCheckout(afterRepeatedConfirmation, {
		type: "formValidated"
	});

	const finished = reduceBookingCheckout(afterRepeatedSubmission, { type: "checkoutFinished" });
	const retryWithoutConfirmation = reduceBookingCheckout(finished, { type: "formValidated" });

	const retryAfterConfirmation = reduceBookingCheckout(
		reduceBookingCheckout(retryWithoutConfirmation, { type: "termsConfirmed" }),
		{ type: "formValidated" }
	);

	expect(afterRepeatedConfirmation).toEqual({ kind: "creatingCheckout" });
	expect(afterRepeatedSubmission).toEqual({ kind: "creatingCheckout" });
	expect(finished).toEqual({ kind: "requiresTerms" });
	expect(retryWithoutConfirmation).toEqual({ kind: "requiresTerms" });
	expect(retryAfterConfirmation).toEqual({ kind: "creatingCheckout" });
});
