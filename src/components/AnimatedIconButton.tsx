import {
	cloneElement,
	isValidElement,
	useRef,
	type FocusEventHandler,
	type ComponentProps,
	type PointerEventHandler,
	type ReactElement,
	type ReactNode,
	type RefObject
} from "react";
import type { VariantProps } from "class-variance-authority";

import { Button, buttonVariants } from "#/components/ui/button";
import type { AnimatedIconHandle } from "#/components/ui/types";

type AnimatedIconButtonChildProps = {
	children?: ReactNode;
	onBlur?: FocusEventHandler;
	onFocus?: FocusEventHandler;
	onPointerEnter?: PointerEventHandler;
	onPointerLeave?: PointerEventHandler;
};

export type AnimatedIconButtonProps = VariantProps<typeof buttonVariants> &
	Omit<ComponentProps<"button">, "children" | "className"> & {
		children: ReactElement<AnimatedIconButtonChildProps>;
		className?: string;
		iconPosition?: "before" | "after";
		renderIcon: (ref: RefObject<AnimatedIconHandle | null>) => ReactNode;
	};

export function AnimatedIconButton({
	children,
	className,
	iconPosition = "after",
	renderIcon,
	size,
	variant,
	...props
}: AnimatedIconButtonProps) {
	const iconRef = useRef<AnimatedIconHandle | null>(null);

	const startIconAnimation = () => {
		iconRef.current?.startAnimation();
	};

	const stopIconAnimation = () => {
		iconRef.current?.stopAnimation();
	};

	if (!isValidElement<AnimatedIconButtonChildProps>(children)) {
		return null;
	}

	const icon = renderIcon(iconRef);

	// Clone the child element so its hover and focus events can control the icon ref.
	const child = cloneElement(children, {
		onPointerEnter: (event) => {
			children.props.onPointerEnter?.(event);
			startIconAnimation();
		},
		onPointerLeave: (event) => {
			children.props.onPointerLeave?.(event);
			stopIconAnimation();
		},
		onFocus: (event) => {
			children.props.onFocus?.(event);
			startIconAnimation();
		},
		onBlur: (event) => {
			children.props.onBlur?.(event);
			stopIconAnimation();
		},
		children: (
			<>
				{iconPosition === "before" ? icon : null}
				{children.props.children}
				{iconPosition === "after" ? icon : null}
			</>
		)
	});

	return (
		<Button
			asChild
			size={size}
			variant={variant}
			className={className}
			{...props}>
			{child}
		</Button>
	);
}
