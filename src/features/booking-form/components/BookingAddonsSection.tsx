import {
	FieldContent,
	Field,
	FieldDescription,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "#/components/ui/field";
import { Check, Clapperboard, Scissors, Smartphone } from "lucide-react";
import { ADDON_OPTIONS, type BookingFormValues } from "#/features/booking-form/lib/form-shared";
import { useBookingFormContext } from "#/features/booking-form/lib/booking-form-context";
import { toOptionId } from "#/lib/bookingdatetime";
import { cn } from "#/lib/utils";

const sectionTitle = "Add-ons";
const sectionDescription =
	"Each session includes three 4K Sony cameras, up to four RODE PodMic microphones, and cinematic lighting already set up.";

const addonCardCopy = {
	"4K UHD Recording": {
		description: "Our highest quality recording, perfect for cropping without losing clarity.",
		icon: Clapperboard,
		price: "+$49",
	},
	"Essential Edit": {
		description: "Professionally synchronised audio with clean cuts between camera angles.",
		icon: Scissors,
		price: "+$99",
	},
	"Clips Package": {
		description:
			"Includes subtitles and vertical cropping so your clips are ready for social media.",
		icon: Smartphone,
		price: "+$79",
	},
} as const satisfies Record<
	(typeof ADDON_OPTIONS)[number],
	{
		description: string;
		icon: React.ComponentType<React.ComponentProps<"svg">>;
		price: string;
	}
>;

export interface BookingAddonsSectionProps {
	sectionHeadingClassName: string;
	transitionClassName: string;
}

export function BookingAddonsSection({
	sectionHeadingClassName,
	transitionClassName,
}: BookingAddonsSectionProps) {
	const formApi = useBookingFormContext();

	return (
		<formApi.Field name="addons">
			{(field) => (
				<FieldSet
					data-field-name="addons"
					className="mt-4">
					<FieldLegend className={sectionHeadingClassName}>{sectionTitle}</FieldLegend>
					<FieldDescription>{sectionDescription}</FieldDescription>
					<div className="flex flex-col gap-4">
						{ADDON_OPTIONS.map((addon) => {
							const isChecked = field.state.value.includes(addon);
							const addonCopy = addonCardCopy[addon];
							const Icon = addonCopy.icon;

							return (
								<FieldLabel
									key={addon}
									htmlFor={`addon-${toOptionId(addon)}`}
									data-state={isChecked ? "checked" : "unchecked"}
									className={cn(
										"w-full cursor-pointer rounded-lg border border-border bg-input/30 transition-all hover:border-primary hover:bg-primary/10 data-[state=checked]:border-primary data-[state=checked]:bg-primary/10",
										transitionClassName,
									)}>
									<Field
										orientation="horizontal"
										className="items-center justify-between gap-4 rounded-lg px-4 py-6">
										<input
											id={`addon-${toOptionId(addon)}`}
											type="checkbox"
											checked={isChecked}
											onChange={(event) => {
												const nextValue = event.target.checked
													? [...field.state.value, addon]
													: field.state.value.filter((value) => value !== addon);

												field.handleChange(nextValue as BookingFormValues["addons"]);
												field.handleBlur();
											}}
											className="sr-only"
										/>
										<div className="flex min-w-0 items-center gap-4">
											<div className="flex shrink-0 items-center justify-center text-primary">
												<Icon className="size-8" />
											</div>
											<FieldContent className="min-w-0 gap-1">
												<div className="flex items-center gap-2">
													<FieldTitle className="text-base">{addon}</FieldTitle>
													{isChecked ? (
														<span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
															<Check className="size-3" />
														</span>
													) : null}
												</div>
												<FieldDescription className="text-pretty">
													{addonCopy.description}
												</FieldDescription>
											</FieldContent>
										</div>
										<span className="shrink-0 text-base font-semibold text-primary">
											{addonCopy.price}
										</span>
									</Field>
								</FieldLabel>
							);
						})}
					</div>
				</FieldSet>
			)}
		</formApi.Field>
	);
}
