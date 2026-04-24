import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { env } from "#/env";

const stripePromise = loadStripe(env.VITE_STRIPE_PUBLISHABLE_KEY);

export interface BookingPaymentModalProps {
	clientSecret: string;
	onClose: () => void;
}

export function BookingPaymentModal({ clientSecret, onClose }: BookingPaymentModalProps) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
			<div className="w-full max-w-3xl rounded-xl border bg-background p-4 shadow-lg">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold">Complete your $50 deposit</h2>
					<button
						type="button"
						onClick={onClose}
						className="pressable text-sm text-muted-foreground">
						Close
					</button>
				</div>

				<EmbeddedCheckoutProvider
					stripe={stripePromise}
					options={{ clientSecret }}>
					<EmbeddedCheckout />
				</EmbeddedCheckoutProvider>
			</div>
		</div>
	);
}
