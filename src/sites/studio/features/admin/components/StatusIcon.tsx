import type { LucideIcon } from "lucide-react";

type StatusIconProps = { className: string; icon: LucideIcon; label: string };

export function StatusIcon({ className, icon: Icon, label }: StatusIconProps) {
	return (
		<span
			className="cursor-help"
			title={label}>
			<Icon
				aria-label={label}
				className={className}
			/>
		</span>
	);
}
