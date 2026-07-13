import type { ReactNode } from "react";
import { Field, FieldLabel, FieldLegend, FieldSet } from "#/components/ui/field";
import { Textarea } from "#/components/ui/textarea";
import { sectionHeadingClassName } from "#studio/features/booking-form/lib/booking-form-styles";

const fieldSetClassName = "gap-5 md:gap-6";
const fieldStackClassName = "gap-1 md:gap-2";
const sectionLegendClassName = `${sectionHeadingClassName} mb-2 md:mb-3`;
const formControlShadowClassName = "shadow-lg shadow-background/25";

interface BookingNotesFieldProps {
	children?: ReactNode;
	disabled?: boolean;
	value: string;
	onBlur?: () => void;
	onChange: (value: string) => void;
}

export function BookingNotesField({
	children,
	disabled = false,
	value,
	onBlur,
	onChange
}: BookingNotesFieldProps) {
	return (
		<FieldSet className={fieldSetClassName}>
			<FieldLegend className={sectionLegendClassName}>Session notes + questions</FieldLegend>
			<Field
				className={fieldStackClassName}
				data-field-name="notes">
				<FieldLabel
					htmlFor="notes"
					className="sr-only">
					Session notes + questions
				</FieldLabel>
				<Textarea
					id="notes"
					name="notes"
					autoComplete="off"
					value={value}
					disabled={disabled}
					placeholder="Number of people, remote guest details, or session questions..."
					className={formControlShadowClassName}
					maxLength={200}
					onChange={(event) => onChange(event.target.value)}
					onBlur={onBlur}
					rows={2}
				/>
				{children}
			</Field>
		</FieldSet>
	);
}
