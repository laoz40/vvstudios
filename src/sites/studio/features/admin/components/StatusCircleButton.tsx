import { cn } from "#/lib/utils";

type StatusCircleButtonProps = {
	ariaLabel: string;
	className: string;
	disabled?: boolean;
	isSelected: boolean;
	onClick: () => void;
};

export function StatusCircleButton({
	ariaLabel,
	className,
	disabled,
	isSelected,
	onClick
}: StatusCircleButtonProps) {
	return (
		<button
			type="button"
			aria-label={ariaLabel}
			title={ariaLabel}
			disabled={disabled}
			className={cn(
				"size-5 rounded-full border border-transparent disabled:opacity-50",
				className,
				isSelected && "ring-2 ring-accent-foreground ring-offset-2 ring-offset-popover"
			)}
			onClick={onClick}
		/>
	);
}
