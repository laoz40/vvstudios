import type { LucideIcon } from "lucide-react";
import { AdminTableInfoPopover } from "#studio/features/admin/components/AdminTableInfoPopover";

type StatusIconProps = { className: string; icon: LucideIcon; label: string };

export function StatusIcon({ className, icon: Icon, label }: StatusIconProps) {
	return (
		<AdminTableInfoPopover
			content={label}
			triggerClassName="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
			<Icon
				aria-hidden
				className={className}
			/>
		</AdminTableInfoPopover>
	);
}
