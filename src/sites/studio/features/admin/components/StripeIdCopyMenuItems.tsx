import BrandStripeIcon from "#/components/ui/brand-stripe-icon";
import { AnimatedDropdownMenuItem } from "#studio/features/admin/components/AnimatedDropdownMenuItem";
import { copyText } from "#studio/features/admin/components/AdminDashboardTableUtils";

type StripeIdCopyMenuItemsProps = { stripePaymentIntentId?: string };

export function StripeIdCopyMenuItems({ stripePaymentIntentId }: StripeIdCopyMenuItemsProps) {
	if (!stripePaymentIntentId) {
		return null;
	}

	return (
		<AnimatedDropdownMenuItem
			onSelect={() => void copyText(stripePaymentIntentId, "Stripe Payment ID")}
			renderIcon={(iconRef) => (
				<BrandStripeIcon
					ref={iconRef}
					size={16}
					aria-hidden
					className="shrink-0 text-current"
				/>
			)}>
			Copy Stripe Payment ID
		</AnimatedDropdownMenuItem>
	);
}
