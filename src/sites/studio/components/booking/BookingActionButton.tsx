import type { ReactElement } from "react";
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

const bookingActionButtonClassName = "h-auto w-full sm:w-auto px-8 py-3 text-base font-medium";

const bookingActionIcons = {
	arrow: { icon: ArrowNarrowRightIcon, iconProps: { strokeWidth: 3, className: "translate-y-px" } },
	home: { icon: HomeIcon, iconProps: {} },
	phone: { icon: PhoneVolume, iconProps: { strokeWidth: 3 } }
};

export function BookingActionButton({
	children,
	disabled,
	emphasis,
	icon
}: BookingActionButtonProps): ReactElement {
	const isSecondary = emphasis === "secondary";
	const actionIcon = bookingActionIcons[icon];

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
			icon={actionIcon.icon}
			iconProps={{ "aria-hidden": true, ...actionIcon.iconProps }}>
			{children}
		</AnimatedIconButton>
	);
}
