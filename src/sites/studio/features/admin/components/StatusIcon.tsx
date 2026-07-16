import type { LucideIcon } from "lucide-react";

type StatusIconProps = { className: string; icon: LucideIcon; label: string };

export function StatusIcon({ className, icon: Icon, label }: StatusIconProps) {
	return (
		<span
			className="cursor-help"
			role="img"
			aria-label={label}
			title={label}>
			<Icon
				aria-hidden
				className={className}
			/>
		</span>
	);
}
