import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "#/components/ui/button";
import { env } from "#/env";
import { X } from "lucide-react";

const stripePromise = loadStripe(env.VITE_STRIPE_PUBLISHABLE_KEY);
const dialogTitle = "$50 Booking Deposit";
const dialogDescription = "Booking deposit is deducted from total payment.";
const closeButtonLabel = "Close payment modal";

export interface BookingPaymentModalProps {
	clientSecret: string;
	onClose: () => void;
}

export function BookingPaymentModal({ clientSecret, onClose }: BookingPaymentModalProps) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
			<div className="bg-popover text-popover-foreground ring-foreground/10 w-full max-w-3xl overflow-hidden rounded-xl p-4 text-sm shadow-2xl outline-none ring-1 max-h-[calc(100vh-2rem)] sm:p-6">
				<div className="space-y-2 pr-10">
					<h2 className="text-xl font-semibold">{dialogTitle}</h2>
					<p className="text-muted-foreground text-sm leading-6">{dialogDescription}</p>
				</div>

				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="absolute top-2 right-2"
					aria-label={closeButtonLabel}
					onClick={onClose}>
					<X />
				</Button>

				<div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
					<EmbeddedCheckoutProvider
						stripe={stripePromise}
						options={{ clientSecret }}>
						<EmbeddedCheckout />
					</EmbeddedCheckoutProvider>
				</div>
			</div>
		</div>
	);
}
