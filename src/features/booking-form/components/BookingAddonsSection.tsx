import {
	FieldContent,
	Field,
	FieldDescription,
	FieldLabel,
	FieldLegend,
	FieldSet,
	FieldTitle,
} from "#/components/ui/field";
import { Video, Scissors, Smartphone } from "lucide-react";
import { useBookingFormContext } from "#/features/booking-form/lib/booking-form-context";
import {
	getCardStateClassName,
	getPillStateClassName,
	sectionHeadingClassName,
	transitionClassName,
} from "#/features/booking-form/lib/booking-form-styles";
import { ADDON_OPTIONS, type BookingFormValues } from "#/features/booking-form/lib/form-shared";
import { toOptionId } from "#/lib/bookingdatetime";
import { cn } from "#/lib/utils";

const sectionTitle = "Add-ons";
const sectionDescription = "Choose add-ons to enhance your session.";
const sectionFooterNote =
	"Each session includes three Sony cameras, up to four RØDE PodMics, and cinematic overhead lighting.";

const addonCardCopy = {
	"4K UHD Recording": {
		description: "Our highest quality recording, perfect for cropping without losing clarity.",
		icon: Video,
		price: "+$49",
	},
	"Essential Edit": {
		description: "Professionally synchronised audio with clean cuts between camera angles.",
		icon: Scissors,
		price: "+$99",
	},
	"Clips Package": {
		description: "10 clips with subtitles and vertical cropping ready for social media.",
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

export function BookingAddonsSection() {
	const formApi = useBookingFormContext();

	return (
		<formApi.Field name="addons">
			{(field) => (
				<FieldSet data-field-name="addons">
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
										"pressable has-focus-visible:border-primary has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2 has-focus-visible:ring-offset-background w-full cursor-pointer rounded-lg border border-border bg-input/30 shadow-lg shadow-background/25",
										transitionClassName,
										getCardStateClassName(isChecked),
										isChecked && "shadow-primary/20",
									)}>
									<Field
										orientation="horizontal"
										className="relative items-center justify-between gap-4 rounded-lg px-4 py-6">
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
											<FieldContent className="min-w-0 gap-1 pr-12 sm:pr-0">
												<FieldTitle className="relative inline-flex w-fit whitespace-nowrap text-base">
													{addon}
													{isChecked ? (
														<span
															className={cn(
																"absolute left-full top-1/2 ml-2 inline-flex -translate-y-1/2 items-center justify-center rounded-lg border px-2.5 py-0.5 text-xs font-medium tracking-wider shadow-md transition-all duration-200 ease-in sm:hidden",
																getPillStateClassName(true),
															)}>
															SELECTED
														</span>
													) : null}
												</FieldTitle>
												<FieldDescription className="text-pretty">
													{addonCopy.description}
												</FieldDescription>
											</FieldContent>
										</div>
										<div className="flex shrink-0 items-center gap-2">
											{isChecked ? (
												<span
													className={cn(
														"hidden items-center justify-center rounded-lg border px-2.5 py-0.5 text-xs font-medium tracking-wider shadow-md transition-all duration-200 ease-in sm:inline-flex md:min-h-8 md:px-3 md:py-1",
														getPillStateClassName(true),
													)}>
													SELECTED
												</span>
											) : null}
											<span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-primary sm:static sm:translate-y-0">
												{addonCopy.price}
											</span>
										</div>
									</Field>
								</FieldLabel>
							);
						})}
						<FieldDescription className="text-pretty italic">{sectionFooterNote}</FieldDescription>
					</div>
				</FieldSet>
			)}
		</formApi.Field>
	);
}
