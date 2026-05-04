import { useEffect } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "#/components/ui/button";
import { env } from "#/env";
import { X } from "lucide-react";

const stripePromise = loadStripe(env.VITE_STRIPE_PUBLISHABLE_KEY);
const closeButtonLabel = "Close payment modal";

export interface BookingPaymentModalProps {
	clientSecret: string;
	onClose: () => void;
}

export function BookingPaymentModal({ clientSecret, onClose }: BookingPaymentModalProps) {
	useEffect(() => {
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, []);

	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-0 sm:items-center"
			data-lenis-prevent
			onWheel={(event) => {
				event.stopPropagation();
			}}>
			<div className="relative w-full max-w-3xl text-sm sm:max-h-[85vh]">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="absolute top-2 right-2 z-10 rounded-full bg-background/80 shadow-sm ring-1 ring-border backdrop-blur sm:-top-4 sm:-right-4"
					aria-label={closeButtonLabel}
					onClick={onClose}>
					<X className="size-5" />
				</Button>

				<div className="bg-popover text-popover-foreground min-h-dvh w-full overflow-x-hidden rounded-none shadow-2xl outline-none sm:min-h-0 sm:max-h-[85vh] sm:overflow-y-auto sm:rounded-xl">
					<div className="w-full overflow-hidden bg-card [&>*]:w-full">
						<EmbeddedCheckoutProvider
							stripe={stripePromise}
							options={{ clientSecret }}>
							<EmbeddedCheckout />
						</EmbeddedCheckoutProvider>
					</div>
				</div>
			</div>
		</div>
	);
}
