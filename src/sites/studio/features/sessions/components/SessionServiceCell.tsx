import { Badge } from "#/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "#/components/ui/tooltip";
import { formatEditingAddonLabel } from "#/domain/booking/addon-quantities";
import {
	dashboardSetupBadgeClassName,
	formatDashboardAddonLabel,
	getDashboardAddonBadgeClassName,
	type EditingAddonQuantities
} from "#studio/features/booking-form/lib/editing-addon-quantities";
import { cn } from "#/lib/utils";

export function DashboardAddonBadge({
	addon,
	quantities
}: {
	addon: string;
	quantities: EditingAddonQuantities;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Badge
					variant="outline"
					className={getDashboardAddonBadgeClassName(addon)}>
					{formatDashboardAddonLabel(addon, quantities)}
				</Badge>
			</TooltipTrigger>
			<TooltipContent>{formatEditingAddonLabel(addon, quantities)}</TooltipContent>
		</Tooltip>
	);
}

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
				<DashboardAddonBadge
					key={addon}
					addon={addon}
					quantities={session}
				/>
			))}
		</div>
	);
}
