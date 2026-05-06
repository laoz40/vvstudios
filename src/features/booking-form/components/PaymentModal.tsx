import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "#/components/ui/button";
import { env } from "#/env";
import { X } from "lucide-react";

const stripePromise = loadStripe(env.VITE_STRIPE_PUBLISHABLE_KEY);
const closeButtonLabel = "Close payment modal";

type InertElement = HTMLElement & { inert: boolean };

export interface BookingPaymentModalProps {
	clientSecret: string;
	onClose: () => void;
}

export function BookingPaymentModal({ clientSecret, onClose }: BookingPaymentModalProps) {
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const [portalElement, setPortalElement] = useState<HTMLDivElement | null>(null);

	useEffect(() => {
		const element = document.createElement("div");
		element.dataset.paymentModalRoot = "true";
		document.body.append(element);
		setPortalElement(element);

		return () => {
			element.remove();
		};
	}, []);

	useEffect(() => {
		if (!portalElement) {
			return;
		}

		const previousActiveElement =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const previousOverflow = document.body.style.overflow;
		const siblings = Array.from(document.body.children).filter(
			(element) => element !== portalElement,
		);
		const previousSiblingState = siblings.map((element) => ({
			element: element as InertElement,
			inert: (element as InertElement).inert,
			ariaHidden: element.getAttribute("aria-hidden"),
		}));

		document.body.style.overflow = "hidden";
		for (const { element } of previousSiblingState) {
			element.inert = true;
			element.setAttribute("aria-hidden", "true");
		}
		closeButtonRef.current?.focus();

		return () => {
			document.body.style.overflow = previousOverflow;
			for (const { element, inert, ariaHidden } of previousSiblingState) {
				element.inert = inert;
				if (ariaHidden === null) {
					element.removeAttribute("aria-hidden");
				} else {
					element.setAttribute("aria-hidden", ariaHidden);
				}
			}
			previousActiveElement?.focus();
		};
	}, [portalElement]);

	if (!portalElement) {
		return null;
	}

	return createPortal(
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Payment"
			className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/80 p-1 sm:p-0"
			data-lenis-prevent
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					onClose();
				}
			}}
			onWheel={(event) => {
				event.stopPropagation();
			}}>
			<div className="relative max-h-[85vh] w-full max-w-3xl text-sm lg:max-w-5xl">
				<Button
					ref={closeButtonRef}
					type="button"
					variant="ghost"
					size="icon"
					className="absolute top-2 right-2 z-10 rounded-full bg-background/80 shadow-sm ring-1 ring-border backdrop-blur sm:-top-4 sm:-right-4"
					aria-label={closeButtonLabel}
					onClick={onClose}>
					<X className="size-5" />
				</Button>

				<div className="bg-popover text-popover-foreground isolate max-h-[85vh] w-full overflow-clip rounded-xl shadow-2xl">
					<div className="max-h-[85vh] w-full overflow-y-auto overflow-x-hidden rounded-xl bg-card [&>*]:w-full">
						<EmbeddedCheckoutProvider
							stripe={stripePromise}
							options={{ clientSecret }}>
							<EmbeddedCheckout />
						</EmbeddedCheckoutProvider>
					</div>
				</div>
			</div>
		</div>,
		portalElement,
	);
}
