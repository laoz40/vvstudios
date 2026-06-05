import { cloneElement, isValidElement, useRef, type ReactElement, type ReactNode } from "react";
import type { VariantProps } from "class-variance-authority";

import { Button, buttonVariants } from "#/components/ui/button";
import type { AnimatedIconHandle } from "#/components/ui/types";

type AnimatedIconButtonChildProps = {
	children?: ReactNode;
	onBlur?: () => void;
	onFocus?: () => void;
	onPointerEnter?: () => void;
	onPointerLeave?: () => void;
};

export type AnimatedIconButtonProps = VariantProps<typeof buttonVariants> & {
	children: ReactElement<AnimatedIconButtonChildProps>;
	className?: string;
	renderIcon: (ref: React.RefObject<AnimatedIconHandle | null>) => ReactNode;
};

export function AnimatedIconButton({
	children,
	className,
	renderIcon,
	size,
	variant,
}: AnimatedIconButtonProps) {
	const iconRef = useRef<AnimatedIconHandle>(null);

	const startIconAnimation = () => {
		iconRef.current?.startAnimation();
	};

	const stopIconAnimation = () => {
		iconRef.current?.stopAnimation();
	};

	if (!isValidElement<AnimatedIconButtonChildProps>(children)) {
		return null;
	}

	// Clone the child link/anchor so its hover and focus events can control the icon ref.
	const child = cloneElement(children, {
		onPointerEnter: startIconAnimation,
		onPointerLeave: stopIconAnimation,
		onFocus: startIconAnimation,
		onBlur: stopIconAnimation,
		children: (
			<>
				{children.props.children}
				{renderIcon(iconRef)}
			</>
		),
	});

	return (
		<Button
			asChild
			size={size}
			variant={variant}
			className={className}>
			{child}
		</Button>
	);
}
