import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { env } from "#/env";
import { Modal } from "#studio/components/Modal";

const stripePromise = loadStripe(env.VITE_STRIPE_PUBLISHABLE_KEY);
const closeButtonLabel = "Close payment modal";

export interface BookingPaymentModalProps {
	clientSecret: string;
	onClose: () => void;
}

export function BookingPaymentModal({ clientSecret, onClose }: BookingPaymentModalProps) {
	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open) {
					onClose();
				}
			}}
			title="Booking Deposit"
			description="The deposit will be deducted from the total cost and is only required to secure your session."
			closeLabel={closeButtonLabel}
			hideHeader
			initialFocus="content"
			size="6xl"
			className="max-h-[calc(100dvh-2rem)] overflow-hidden p-0"
			bodyClassName="overflow-y-auto overflow-x-hidden rounded-xl [-webkit-overflow-scrolling:touch] [&>*]:w-full">
			<EmbeddedCheckoutProvider
				stripe={stripePromise}
				options={{ clientSecret }}>
				<EmbeddedCheckout />
			</EmbeddedCheckoutProvider>
		</Modal>
	);
}
