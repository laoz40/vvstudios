export type BookingCheckoutState =
	| { kind: "requiresTerms" }
	| { kind: "validatingForm" }
	| { kind: "creatingCheckout" };

export type BookingCheckoutEvent =
	| { type: "termsConfirmed" }
	| { type: "formValidated" }
	| { type: "formInvalid" }
	| { type: "checkoutFinished" };

export const initialBookingCheckoutState: BookingCheckoutState = { kind: "requiresTerms" };

// Accepting terms allows one checkout attempt, after the form is validated again.
// Finishing that attempt requires a new confirmation before another checkout.
export function reduceBookingCheckout(
	state: BookingCheckoutState,
	event: BookingCheckoutEvent
): BookingCheckoutState {
	switch (event.type) {
		case "termsConfirmed":
			return state.kind === "requiresTerms" ? { kind: "validatingForm" } : state;
		case "formValidated":
			return state.kind === "validatingForm" ? { kind: "creatingCheckout" } : state;
		case "formInvalid":
			return state.kind === "validatingForm" ? { kind: "requiresTerms" } : state;
		case "checkoutFinished":
			return state.kind === "creatingCheckout" ? { kind: "requiresTerms" } : state;
		default: {
			const exhaustive: never = event;

			return exhaustive;
		}
	}
}
