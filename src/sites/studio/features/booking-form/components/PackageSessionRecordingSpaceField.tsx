import { RecordingSpaceField } from "#studio/features/booking-form/components/RecordingSpaceField";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";

type RecordingSpace = Exclude<BookingFormValues["service"], "">;

export function PackageSessionRecordingSpaceField({
	disabled,
	value,
	onChange
}: {
	disabled: boolean;
	value: RecordingSpace | "";
	onChange: (value: RecordingSpace) => void;
}) {
	return (
		<RecordingSpaceField
			disabled={disabled}
			idPrefix="package-session-service"
			label="RECORDING SPACE *"
			value={value}
			onChange={onChange}
		/>
	);
}
