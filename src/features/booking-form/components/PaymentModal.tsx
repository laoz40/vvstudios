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
			className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-1 sm:p-0"
			data-lenis-prevent
			onWheel={(event) => {
				event.stopPropagation();
			}}>
			<div className="relative max-h-[85vh] w-full max-w-3xl text-sm lg:max-w-5xl">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="absolute top-2 right-2 z-10 rounded-full bg-background/80 shadow-sm ring-1 ring-border backdrop-blur sm:-top-4 sm:-right-4"
					aria-label={closeButtonLabel}
					onClick={onClose}>
					<X className="size-5" />
				</Button>

				<div className="bg-popover text-popover-foreground isolate max-h-[85vh] w-full overflow-clip rounded-xl shadow-2xl outline-none">
					<div className="max-h-[85vh] w-full overflow-y-auto overflow-x-hidden rounded-xl bg-card [&>*]:w-full">
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
