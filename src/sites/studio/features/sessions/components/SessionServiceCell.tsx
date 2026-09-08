import { Badge } from "#/components/ui/badge";
import type { EditingAddonQuantities } from "#studio/features/booking-form/lib/editing-addon-quantities";
import { formatDashboardAddonLabel } from "#studio/features/booking-form/lib/editing-addon-quantities";
import { cn } from "#/lib/utils";

type SessionServiceCellProps<TSession extends EditingAddonQuantities> = {
	className?: string;
	session: TSession & { addons: readonly string[]; service: string };
};

export function SessionServiceCell<TSession extends EditingAddonQuantities>({
	className,
	session
}: SessionServiceCellProps<TSession>) {
	return (
		<div className={cn("flex flex-col gap-2 whitespace-normal", className)}>
			<p className="font-medium">{session.service}</p>
			{session.addons.length > 0 ? (
				<div className="flex flex-wrap gap-1">
					{session.addons.map((addon) => (
						<Badge
							key={addon}
							variant="outline">
							{formatDashboardAddonLabel(addon, session)}
						</Badge>
					))}
				</div>
			) : null}
		</div>
	);
}
