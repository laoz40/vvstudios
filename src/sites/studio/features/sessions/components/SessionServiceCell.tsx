import { Badge } from "#/components/ui/badge";
import {
	dashboardSetupBadgeClassName,
	formatDashboardAddonLabel,
	getDashboardAddonBadgeClassName,
	type EditingAddonQuantities
} from "#studio/features/booking-form/lib/editing-addon-quantities";
import { cn } from "#/lib/utils";

type SessionServiceCellProps<TSession extends EditingAddonQuantities> = {
	className?: string;
	duration?: string;
	session: TSession & { addons: readonly string[]; service: string };
};

export function SessionServiceCell<TSession extends EditingAddonQuantities>({
	className,
	duration,
	session
}: SessionServiceCellProps<TSession>) {
	return (
		<div className={cn("flex flex-wrap gap-1 whitespace-normal", className)}>
			<Badge
				variant="outline"
				className={dashboardSetupBadgeClassName}>
				{duration ? `${session.service} · ${duration}` : session.service}
			</Badge>
			{session.addons.map((addon) => (
				<Badge
					key={addon}
					variant="outline"
					className={getDashboardAddonBadgeClassName(addon)}>
					{formatDashboardAddonLabel(addon, session)}
				</Badge>
			))}
		</div>
	);
}
