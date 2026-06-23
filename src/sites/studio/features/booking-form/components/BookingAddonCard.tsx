import { type ComponentProps, type ComponentType } from "react";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldTitle
} from "#/components/ui/field";
import { cn } from "#/lib/utils";
import {
	getCardStateClassName,
	getPillStateClassName,
	transitionClassName
} from "#studio/features/booking-form/lib/booking-form-styles";
import type { BookingAddon } from "#studio/features/booking-form/lib/form-shared";
import {
	ADDON_PRICES,
	formatBookingPrice
} from "#studio/features/booking-form/lib/booking-pricing";
import { toOptionId } from "#studio/lib/bookingdatetime";
import { Globe, Scissors, ScrollText, Smartphone, Video } from "lucide-react";

const addonCardCopy = {
	"4K UHD Recording": {
		description: "Highest quality recording, perfect for cropping without losing clarity.",
		icon: Video
	},
	Teleprompter: {
		description: "Displays your script in front of the camera to improve your delivery.",
		icon: ScrollText
	},
	"Essential Edit": {
		description: "Professionally synchronised audio; clean cuts between camera angles.",
		icon: Scissors
	},
	"Clips Package": {
		description: "10 edited clips with subtitles and vertical cropping for social media.",
		icon: Smartphone
	},
	"Remote Podcast": {
		description: "Record with guests globally using professional equipment.",
		icon: Globe
	}
} as const satisfies Record<
	BookingAddon,
	{ description: string; icon: ComponentType<ComponentProps<"svg">> }
>;

export interface BookingAddonCardProps {
	addon: BookingAddon;
	checked: boolean;
	onCheckedChange: (addon: BookingAddon, checked: boolean) => void;
}

export function BookingAddonCard({ addon, checked, onCheckedChange }: BookingAddonCardProps) {
	const addonCopy = addonCardCopy[addon];
	const Icon = addonCopy.icon;
	const addonId = `addon-${toOptionId(addon)}`;

	return (
		<FieldLabel
			htmlFor={addonId}
			data-state={checked ? "checked" : "unchecked"}
			className={cn(
				"pressable has-focus-visible:border-primary has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background w-full cursor-pointer rounded-lg border bg-input/30 shadow-lg shadow-background/25",
				transitionClassName,
				getCardStateClassName(checked),
				checked && "shadow-primary/20"
			)}>
			<Field
				orientation="horizontal"
				className="relative items-center justify-between gap-4 rounded-lg px-4 py-6">
				<input
					id={addonId}
					type="checkbox"
					checked={checked}
					onChange={(event) => onCheckedChange(addon, event.target.checked)}
					className="sr-only"
				/>
				<div className="flex min-w-0 items-center gap-4">
					<div className="flex shrink-0 items-center justify-center text-primary">
						<Icon className="size-8" />
					</div>
					<FieldContent className="min-w-0 gap-1 pr-12 sm:pr-0">
						<FieldTitle className="relative inline-flex w-fit whitespace-nowrap text-base">
							{addon}
							{checked ? (
								<span
									className={cn(
										"absolute left-full top-1/2 ml-2 inline-flex -translate-y-1/2 items-center justify-center rounded-lg border px-2.5 py-0.5 text-xs font-medium tracking-wider shadow-md transition-all duration-200 ease-in sm:hidden",
										getPillStateClassName(true)
									)}>
									SELECTED
								</span>
							) : null}
						</FieldTitle>
						<FieldDescription className="text-pretty">{addonCopy.description}</FieldDescription>
					</FieldContent>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{checked ? (
						<span
							className={cn(
								"hidden items-center justify-center rounded-lg border px-2.5 py-0.5 text-xs font-medium tracking-wider shadow-md transition-all duration-200 ease-in sm:inline-flex md:min-h-8 md:px-3 md:py-1",
								getPillStateClassName(true)
							)}>
							SELECTED
						</span>
					) : null}
					<span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-primary sm:static sm:translate-y-0">
						+{formatBookingPrice(ADDON_PRICES[addon])}
					</span>
				</div>
			</Field>
		</FieldLabel>
	);
}
