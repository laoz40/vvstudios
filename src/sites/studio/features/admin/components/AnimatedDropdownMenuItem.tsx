import { useRef, type ComponentProps, type ReactNode, type RefObject } from "react";
import { DropdownMenuItem } from "#/components/ui/dropdown-menu";
import type { AnimatedIconHandle } from "#/components/ui/types";

type AnimatedDropdownMenuItemProps = ComponentProps<typeof DropdownMenuItem> & {
	children: ReactNode;
	renderIcon: (ref: RefObject<AnimatedIconHandle | null>) => ReactNode;
};

export function AnimatedDropdownMenuItem({
	children,
	renderIcon,
	onBlur,
	onFocus,
	onPointerEnter,
	onPointerLeave,
	...props
}: AnimatedDropdownMenuItemProps) {
	const iconRef = useRef<AnimatedIconHandle | null>(null);

	return (
		<DropdownMenuItem
			{...props}
			onPointerEnter={(event) => {
				onPointerEnter?.(event);
				iconRef.current?.startAnimation();
			}}
			onPointerLeave={(event) => {
				onPointerLeave?.(event);
				iconRef.current?.stopAnimation();
			}}
			onFocus={(event) => {
				onFocus?.(event);
				iconRef.current?.startAnimation();
			}}
			onBlur={(event) => {
				onBlur?.(event);
				iconRef.current?.stopAnimation();
			}}>
			{renderIcon(iconRef)}
			<span>{children}</span>
		</DropdownMenuItem>
	);
}
