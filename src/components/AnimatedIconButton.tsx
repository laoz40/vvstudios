import {
	useRef,
	type ComponentProps,
	type ComponentType,
	type ReactElement,
	type Ref
} from "react";
import type { VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { Button, buttonVariants } from "#/components/ui/button";
import type { AnimatedIconHandle, AnimatedIconProps } from "#/components/ui/types";

export type AnimatedIconButtonProps = VariantProps<typeof buttonVariants> &
	Omit<ComponentProps<"button">, "children"> & {
		children: ReactElement;
		icon: ComponentType<AnimatedIconProps & { ref?: Ref<AnimatedIconHandle> }>;
		iconPosition?: "before" | "after";
		iconProps?: AnimatedIconProps;
	};

export function AnimatedIconButton({
	children,
	icon: Icon,
	iconPosition = "after",
	iconProps,
	onBlur,
	onFocus,
	onPointerEnter,
	onPointerLeave,
	...props
}: AnimatedIconButtonProps) {
	const iconRef = useRef<AnimatedIconHandle | null>(null);

	const icon = (
		<Icon
			{...iconProps}
			ref={iconRef}
		/>
	);

	return (
		<Button
			asChild
			{...props}
			onPointerEnter={(event) => {
				iconRef.current?.startAnimation();
				onPointerEnter?.(event);
			}}
			onPointerLeave={(event) => {
				iconRef.current?.stopAnimation();
				onPointerLeave?.(event);
			}}
			onFocus={(event) => {
				iconRef.current?.startAnimation();
				onFocus?.(event);
			}}
			onBlur={(event) => {
				iconRef.current?.stopAnimation();
				onBlur?.(event);
			}}>
			{iconPosition === "before" ? icon : null}
			<Slot.Slottable>{children}</Slot.Slottable>
			{iconPosition === "after" ? icon : null}
		</Button>
	);
}
