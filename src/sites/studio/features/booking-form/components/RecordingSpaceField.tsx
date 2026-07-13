import { Image } from "@unpic/react";
import type { ReactNode } from "react";
import armchairSetupImage from "#studio/assets/gallery/armchair-setup.webp";
import tableSetupImage from "#studio/assets/gallery/table-setup.webp";
import { FieldLegend, FieldSet } from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";
import {
	getCardStateClassName,
	getFooterStateClassName,
	getPillStateClassName,
	sectionHeadingClassName,
	transitionClassName
} from "#studio/features/booking-form/lib/booking-form-styles";
import { toOptionId } from "#studio/lib/bookingdatetime";
import { cn } from "#/lib/utils";

const recordingSpaceOptions = [
	{
		value: "Table Setup" as const,
		title: "Table Setup",
		capacity: "up to 4 people",
		image: tableSetupImage,
		imageAlt: "Podcast table setup with microphones and studio lighting"
	},
	{
		value: "Armchair Setup" as const,
		title: "Armchair Setup",
		capacity: "up to 2 people",
		image: armchairSetupImage,
		imageAlt: "Podcast open setup with warm lamps and casual seating"
	}
] as const;

type RecordingSpace = BookingFormValues["service"];

interface RecordingSpaceFieldProps {
	children?: ReactNode;
	disabled?: boolean;
	headerAction?: ReactNode;
	idPrefix: string;
	label: string;
	value: RecordingSpace;
	onChange: (value: Exclude<RecordingSpace, "">) => void;
}

export function RecordingSpaceField({
	children,
	disabled = false,
	headerAction,
	idPrefix,
	label,
	value,
	onChange
}: RecordingSpaceFieldProps) {
	return (
		<section
			data-field-name="service"
			className="scroll-mt-32 space-y-1 sm:scroll-mt-40">
			<FieldSet className="gap-1">
				<div className="flex items-center justify-between gap-4">
					<FieldLegend className={cn(sectionHeadingClassName, headerAction && "mb-0")}>
						{label}
					</FieldLegend>
					{headerAction}
				</div>
				<RadioGroup
					disabled={disabled}
					value={value}
					onValueChange={(nextValue) => onChange(nextValue as Exclude<RecordingSpace, "">)}
					className="grid gap-4 md:grid-cols-2">
					{recordingSpaceOptions.map((option) => (
						<div key={option.value}>
							<RadioGroupItem
								value={option.value}
								id={`${idPrefix}-${toOptionId(option.value)}`}
								className="peer sr-only size-0"
							/>
							<label
								htmlFor={`${idPrefix}-${toOptionId(option.value)}`}
								className={cn(
									"pressable group relative block cursor-pointer overflow-hidden rounded-lg border",
									"shadow-lg shadow-background/25",
									"peer-focus-visible:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
									"peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
									"md:hover:bg-primary/5",
									transitionClassName,
									getCardStateClassName(value === option.value),
									value === option.value && "md:bg-primary/5 shadow-primary/20",
									disabled && "cursor-not-allowed opacity-50"
								)}>
								<div className="relative w-full overflow-hidden">
									<Image
										src={option.image}
										alt={option.imageAlt}
										layout="constrained"
										width={1885}
										height={1060}
										className={cn(
											"h-auto w-full transition-transform duration-300 group-hover:scale-105",
											value === option.value && "scale-[1.02]"
										)}
									/>
									<div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background/95 via-background/65 to-transparent md:hidden" />
								</div>
								<div
									className={cn(
										"pointer-events-none absolute inset-x-0 bottom-0 z-10",
										"flex items-center justify-between gap-2",
										"px-3 py-1 md:static md:px-3 md:py-1.5",
										"backdrop-blur-[3px] md:group-hover:bg-primary/10",
										getFooterStateClassName(value === option.value),
										value === option.value && "md:bg-primary/10"
									)}>
									<p className="text-base font-semibold text-foreground">
										{option.title}{" "}
										<span className="text-muted-foreground font-light">({option.capacity})</span>
									</p>
									<span
										className={cn(
											"inline-flex items-center justify-center rounded-lg border",
											"px-2.5 py-0.5 md:min-h-8 md:px-3 md:py-1",
											"text-xs font-medium tracking-wider",
											"shadow-md transition-all duration-200 ease-in",
											getPillStateClassName(value === option.value)
										)}>
										{value === option.value ? "SELECTED" : "SELECT"}
									</span>
								</div>
							</label>
						</div>
					))}
				</RadioGroup>
				{children}
			</FieldSet>
		</section>
	);
}
