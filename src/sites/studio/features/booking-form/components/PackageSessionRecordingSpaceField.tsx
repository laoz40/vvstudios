import { LoaderCircle } from "lucide-react";
import { Button } from "#/components/ui/button";
import { RecordingSpaceField } from "#studio/features/booking-form/components/RecordingSpaceField";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";

type RecordingSpace = Exclude<BookingFormValues["service"], "">;

export function PackageSessionRecordingSpaceField({
	disabled,
	isDefault,
	isSavingDefault,
	value,
	onChange,
	onMakeDefault
}: {
	disabled: boolean;
	isDefault: boolean;
	isSavingDefault: boolean;
	value: RecordingSpace | "";
	onChange: (value: RecordingSpace) => void;
	onMakeDefault: () => void;
}) {
	return (
		<RecordingSpaceField
			disabled={disabled}
			idPrefix="package-session-service"
			label="RECORDING SPACE *"
			value={value}
			onChange={onChange}
			headerAction={
				<Button
					type="button"
					variant="outline"
					size="xs"
					className="bg-surface-subtle hover:darker-bg-surface-subtle text-xs!"
					disabled={disabled || !value || isDefault || isSavingDefault}
					onClick={onMakeDefault}>
					{isSavingDefault ? (
						<LoaderCircle
							data-icon="inline-start"
							className="animate-spin"
						/>
					) : null}
					{isSavingDefault ? "Saving" : "Set default space"}
				</Button>
			}
		/>
	);
}
