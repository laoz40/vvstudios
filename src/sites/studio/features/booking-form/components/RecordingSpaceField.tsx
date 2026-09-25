import { Image } from "@unpic/react";
import { Maximize2, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { BookingSelectionCheck } from "#studio/features/booking-form/components/BookingSelectionCheck";
import { Button } from "#/components/ui/button";
import { FieldLegend, FieldSet } from "#/components/ui/field";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { ImageViewer } from "#studio/components/photos/ImageViewer";
import {
	armchairSetupPhoto,
	musicSetupPhoto,
	tableSetupPhoto,
	type PhotoGalleryImage
} from "#studio/content/photos";
import {
	recordingSpaceSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
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
	{ value: "Table Setup" as const, title: "Table Setup", capacity: 4, photo: tableSetupPhoto },
	{
		value: "Armchair Setup" as const,
		title: "Armchair Setup",
		capacity: 2,
		photo: armchairSetupPhoto
	},
	{ value: "Music Setup" as const, title: "Music Setup", photo: musicSetupPhoto }
] as const;

type RecordingSpace = BookingFormValues["service"];

interface RecordingSpaceFieldProps {
	children?: ReactNode;
	disabled?: boolean;
	headerAction?: ReactNode;
	idPrefix: string;
	label: string;
	selectionIndicatorVisibility?: "all" | "mobile";
	value: RecordingSpace;
	onChange: (value: Exclude<RecordingSpace, "">) => void;
}

export function RecordingSpaceField({
	children,
	disabled = false,
	headerAction,
	idPrefix,
	label,
	selectionIndicatorVisibility = "all",
	value,
	onChange
}: RecordingSpaceFieldProps) {
	const [previewImage, setPreviewImage] = useState<PhotoGalleryImage | null>(null);

	return (
		<>
			<section
				data-field-name="service"
				className="scroll-mt-32 space-y-1 sm:scroll-mt-40">
				<FieldSet className="gap-1">
					<div className="flex items-center justify-between gap-4">
						<FieldLegend className={`${sectionHeadingClassName} mb-0`}>{label}</FieldLegend>
						{headerAction}
					</div>
					<RadioGroup
						disabled={disabled}
						value={value}
						onValueChange={(nextValue) => {
							const recordingSpace = recordingSpaceSchema.safeParse(nextValue);

							if (recordingSpace.success) {
								onChange(recordingSpace.data);
							}
						}}
						className="grid gap-4 md:grid-cols-3">
						{recordingSpaceOptions.map((option) => (
							<div key={option.value}>
								<RadioGroupItem
									value={option.value}
									id={`${idPrefix}-${toOptionId(option.value)}`}
									className="peer sr-only size-0"
								/>
								<div
									className={cn(
										"pressable group relative block cursor-pointer overflow-hidden rounded-lg border shadow-lg shadow-background/25 peer-focus-visible:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
										transitionClassName,
										getCardStateClassName(value === option.value),
										value === option.value && "shadow-primary/20",
										disabled && "cursor-not-allowed opacity-50"
									)}>
									<label
										htmlFor={`${idPrefix}-${toOptionId(option.value)}`}
										className={cn("block cursor-pointer", disabled && "cursor-not-allowed")}>
										<div className="overflow-hidden">
											<Image
												src={option.photo.src}
												alt={option.photo.alt}
												layout="constrained"
												width={option.photo.width}
												height={option.photo.height}
												className={cn(
													"h-auto w-full transition-transform duration-300 group-hover:scale-105",
													value === option.value && "scale-[1.02]"
												)}
											/>
										</div>
										<div
											className={cn(
												"flex items-center justify-between gap-2 px-3 py-1.5",
												transitionClassName,
												getFooterStateClassName(value === option.value)
											)}>
											<p className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
												{option.title}
												{"capacity" in option ? (
													<span className="inline-flex items-center gap-0.5 font-light text-muted-foreground">
														<Users
															aria-hidden="true"
															className="size-4"
														/>
														1-{option.capacity}
														<span className="sr-only"> people</span>
													</span>
												) : null}
											</p>
											{value === option.value ? (
												<BookingSelectionCheck
													className={cn(selectionIndicatorVisibility === "mobile" && "md:hidden")}
												/>
											) : (
												<span
													className={cn(
														"inline-flex items-center justify-center rounded-lg border px-3 py-0.5 text-xs font-medium tracking-wider shadow-md transition-all duration-200 ease-in",
														getPillStateClassName(false),
														selectionIndicatorVisibility === "mobile" && "md:hidden"
													)}>
													Select
												</span>
											)}
										</div>
									</label>
									<Button
										type="button"
										variant="secondary"
										size="icon-xs"
										className="absolute top-3 right-3 z-20 rounded-full bg-background/80 opacity-100 shadow-md backdrop-blur transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
										aria-label={`View larger image of ${option.title}`}
										onClick={(event) => {
											event.preventDefault();
											event.stopPropagation();
											setPreviewImage({ ...option.photo, caption: option.title });
										}}>
										<Maximize2
											aria-hidden="true"
											className="size-3"
										/>
									</Button>
								</div>
							</div>
						))}
					</RadioGroup>
					{children}
				</FieldSet>
			</section>
			<ImageViewer
				image={previewImage}
				onClose={() => {
					setPreviewImage(null);
				}}
			/>
		</>
	);
}
