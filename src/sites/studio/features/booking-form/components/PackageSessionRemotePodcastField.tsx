import { Switch } from "#/components/ui/switch";
import { cn } from "#/lib/utils";
import {
	ADDON_PRICES,
	formatBookingPrice
} from "#studio/features/booking-form/lib/booking-pricing";

export function PackageSessionRemotePodcastField({
	checked,
	disabled,
	id,
	onCheckedChange
}: {
	checked: boolean;
	disabled: boolean;
	id: string;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<label
			htmlFor={id}
			className={cn(
				"flex cursor-pointer items-center justify-between gap-3 rounded-lg py-4 px-1 transition-colors",
				disabled && "cursor-not-allowed opacity-50"
			)}>
			<span className="grid gap-1">
				<span className="flex items-center gap-2 font-medium text-foreground">
					<span>Use Remote Podcast Add-on?</span>
					<span className="text-primary">
						+{formatBookingPrice(ADDON_PRICES["Remote Podcast"])}
					</span>
				</span>
				<span className="text-sm text-muted-foreground">
					Record with guests globally using professional equipment.
				</span>
			</span>
			<Switch
				id={id}
				checked={checked}
				disabled={disabled}
				onCheckedChange={onCheckedChange}
			/>
		</label>
	);
}
