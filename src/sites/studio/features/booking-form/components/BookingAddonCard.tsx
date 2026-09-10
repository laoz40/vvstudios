import { type ComponentProps, type ComponentType } from "react";
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
	FieldTitle
} from "#/components/ui/field";
import { cn } from "#/lib/utils";
import { BookingSelectionCheck } from "#studio/features/booking-form/components/BookingSelectionCheck";
import {
	getCardStateClassName,
	transitionClassName
} from "#studio/features/booking-form/lib/booking-form-styles";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { getCustomerAddonDisplayLabel } from "#studio/features/booking-form/lib/booking-form-model";
import {
	ADDON_PRICES,
	formatBookingPrice
} from "#studio/features/booking-form/lib/booking-pricing";
import { toOptionId } from "#studio/lib/bookingdatetime";
import {
	Globe,
	Scissors,
	ScrollText,
	Smartphone,
	Sparkles,
	Video,
	WandSparkles
} from "lucide-react";

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
		description:
			"Mistakes removed, clean cuts between cameras. Ready to post, no B-roll or graphics.",
		icon: Scissors
	},
	"Complete Edit": {
		description:
			"Opens strong and keeps people watching. Intro snippet with subtitles & b-roll. Filler words and silences are cut.",
		icon: WandSparkles
	},
	"Clip Volume Pack": {
		description: "10 clips with basic subtitles and vertical cropping. Nothing fancy.",
		icon: Smartphone
	},
	"Handcrafted Clips": {
		description:
			"Five clips cut to stand out in the feed. Animated subtitles, B-roll, and custom graphics.",
		icon: Sparkles
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
	disabled?: boolean;
	onCheckedChange: (addon: BookingAddon, checked: boolean) => void;
}

export function BookingAddonCard({
	addon,
	checked,
	disabled = false,
	onCheckedChange
}: BookingAddonCardProps) {
	const addonCopy = addonCardCopy[addon];
	const Icon = addonCopy.icon;
	const addonId = `addon-${toOptionId(addon)}`;
	const addonLabel = getCustomerAddonDisplayLabel(addon);

	return (
		<FieldLabel
			htmlFor={addonId}
			data-state={checked ? "checked" : "unchecked"}
			className={cn(
				"pressable w-full cursor-pointer rounded-lg border bg-input/30",
				"shadow-lg shadow-background/25",
				disabled && "cursor-not-allowed opacity-50",
				"has-focus-visible:border-primary has-focus-visible:ring-2 has-focus-visible:ring-ring",
				"has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background",
				transitionClassName,
				getCardStateClassName(checked),
				checked && "shadow-primary/20"
			)}>
			<Field
				orientation="horizontal"
				className="items-center justify-between gap-4 rounded-lg px-4 py-6">
				<input
					id={addonId}
					type="checkbox"
					checked={checked}
					aria-label={addonLabel}
					disabled={disabled}
					onChange={(event) => onCheckedChange(addon, event.target.checked)}
					className="sr-only"
				/>
				<div className="flex min-w-0 items-center gap-4">
					<div className="flex shrink-0 items-center justify-center text-primary">
						<Icon className="size-8" />
					</div>
					<FieldContent className="min-w-0 gap-1">
						<div className="flex w-full min-w-0 items-center justify-between gap-2 sm:contents">
							<div className="flex min-w-0 items-center gap-2 sm:contents">
								<FieldTitle className="text-base sm:w-fit sm:whitespace-nowrap">
									{addonLabel}
								</FieldTitle>
								{checked ? (
									<BookingSelectionCheck className="sm:hidden" />
								) : null}
							</div>
							<span className="shrink-0 text-lg font-semibold text-primary sm:hidden">
								+{formatBookingPrice(ADDON_PRICES[addon])}
							</span>
						</div>
						<FieldDescription className="text-pretty">{addonCopy.description}</FieldDescription>
					</FieldContent>
				</div>
				<div className="hidden shrink-0 items-center gap-2 sm:flex">
					{checked ? <BookingSelectionCheck /> : null}
					<span className="text-lg font-semibold text-primary">
						+{formatBookingPrice(ADDON_PRICES[addon])}
					</span>
				</div>
			</Field>
		</FieldLabel>
	);
}
