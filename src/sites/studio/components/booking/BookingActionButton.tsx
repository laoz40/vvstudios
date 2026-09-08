import type { ReactElement } from "react";
import { exhaustiveCheck } from "#/lib/result";
import { AnimatedIconButton, type AnimatedIconButtonProps } from "#/components/AnimatedIconButton";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import HomeIcon from "#/components/ui/home-icon";
import PhoneVolume from "#/components/ui/phone-volume";
import { cn } from "#/lib/utils";

type BookingActionButtonChild = AnimatedIconButtonProps["children"];

type BookingActionButtonProps = {
	children: BookingActionButtonChild;
	disabled?: boolean;
	emphasis: "primary" | "secondary";
	icon: "arrow" | "home" | "phone";
};

const bookingActionButtonClassName = cn(
	"h-auto w-full sm:w-auto",
	"px-8 py-3",
	"text-base font-medium"
);

function renderBookingActionIcon(
	icon: BookingActionButtonProps["icon"],
	iconRef: Parameters<AnimatedIconButtonProps["renderIcon"]>[0]
): ReactElement {
	switch (icon) {
		case "arrow":
			return (
				<ArrowNarrowRightIcon
					ref={iconRef}
					strokeWidth={3}
					className="translate-y-px"
					aria-hidden
				/>
			);

		case "home":
			return (
				<HomeIcon
					ref={iconRef}
					aria-hidden
				/>
			);

		case "phone":
			return (
				<PhoneVolume
					ref={iconRef}
					aria-hidden
					strokeWidth={3}
				/>
			);
		default:
			return exhaustiveCheck(icon);
	}
}

export function BookingActionButton({
	children,
	disabled,
	emphasis,
	icon
}: BookingActionButtonProps): ReactElement {
	const isSecondary = emphasis === "secondary";

	return (
		<AnimatedIconButton
			size="lg"
			disabled={disabled}
			variant={isSecondary ? "outline" : undefined}
			iconPosition={icon === "arrow" ? "after" : "before"}
			className={cn(
				bookingActionButtonClassName,
				isSecondary ? "border-none shadow-md shadow-background/25" : "shadow-lg shadow-primary/45"
			)}
			renderIcon={(iconRef) => renderBookingActionIcon(icon, iconRef)}>
			{children}
		</AnimatedIconButton>
	);
}
