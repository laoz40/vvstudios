import Stack3Icon from "#/components/ui/stack-3-icon";
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
				<Stack3Icon
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
