import { LoaderCircle } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Modal } from "#studio/components/Modal";
import {
	BookingDateTimePicker,
	type BookingDateTimePickerProps
} from "#studio/features/booking-form/components/BookingDateTimePicker";
import { BookingNotesField } from "#studio/features/booking-form/components/BookingNotesField";
import { PackageSessionRecordingSpaceField } from "#studio/features/booking-form/components/PackageSessionRecordingSpaceField";
import { PackageSessionRemotePodcastField } from "#studio/features/booking-form/components/PackageSessionRemotePodcastField";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";
import { isAddonAvailableForService } from "#studio/features/booking-form/lib/booking-form-model";
import { cn } from "#/lib/utils";
import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";

type PackageData = NonNullable<
	FunctionReturnType<typeof api.packageScheduling.getPackageByToken>[1]
>;

interface PackageSessionSelection {
	dateValue: string;
	notes: string;
	remotePodcast: boolean;
	service: BookingFormValues["service"];
	time: string;
}

interface PackageSessionEditorDialogProps {
	availability: BookingDateTimePickerProps["availability"];
	duration: PackageData["duration"];
	hasActiveSession: boolean;
	isDefaultSpace: boolean;
	isOpen: boolean;
	isSavingDefaultSpace: boolean;
	isSelectedBookingSaved: boolean;
	onDateChange: (dateValue: string) => void;
	onMakeDefaultSpace: () => void;
	onNotesChange: (notes: string) => void;
	onOpenChange: (open: boolean) => void;
	onRemotePodcastChange: (checked: boolean) => void;
	onRequestSaveSession: () => void;
	onServiceChange: (service: Exclude<BookingFormValues["service"], "">) => void;
	onTimeChange: (time: string) => void;
	preventClose: boolean;
	savingSessionKey: string | null;
	selection: PackageSessionSelection;
	sessionKey: string;
	sessionNumber: number;
	timeSelectionMessage: BookingDateTimePickerProps["timeSelectionMessage"];
}

export function PackageSessionEditorDialog({
	availability,
	duration,
	hasActiveSession,
	isDefaultSpace,
	isOpen,
	isSavingDefaultSpace,
	isSelectedBookingSaved,
	onDateChange,
	onMakeDefaultSpace,
	onNotesChange,
	onOpenChange,
	onRemotePodcastChange,
	onRequestSaveSession,
	onServiceChange,
	onTimeChange,
	preventClose,
	savingSessionKey,
	selection,
	sessionKey,
	sessionNumber,
	timeSelectionMessage
}: PackageSessionEditorDialogProps) {
	const isSelectionIncomplete = !selection.dateValue || !selection.service || !selection.time;
	const showRemotePodcastField = isAddonAvailableForService(selection.service, "Remote Podcast");

	const isSaveDisabled =
		!hasActiveSession ||
		isSelectionIncomplete ||
		isSelectedBookingSaved ||
		savingSessionKey !== null;

	let saveButtonText = "SAVE SESSION";

	if (savingSessionKey === sessionKey) {
		saveButtonText = "SAVING";
	} else if (isSelectedBookingSaved) {
		saveButtonText = "SAVED";
	}

	return (
		<Modal
			open={isOpen}
			onOpenChange={onOpenChange}
			preventClose={preventClose}
			size="4xl"
			initialFocus="content"
			title={`Schedule session ${sessionNumber}`}
			closeLabel="Close session scheduling"
			bodyClassName="flex flex-col gap-8">
			<div className="flex flex-col gap-6">
				<BookingDateTimePicker
					availability={availability}
					disabled={savingSessionKey !== null}
					duration={duration}
					onDateChange={onDateChange}
					onTimeChange={onTimeChange}
					selectedTime={selection.time}
					timeSelectionMessage={timeSelectionMessage}
				/>
			</div>
			<div className="flex flex-col gap-4">
				<PackageSessionRecordingSpaceField
					disabled={savingSessionKey !== null}
					isDefault={isDefaultSpace}
					isSavingDefault={isSavingDefaultSpace}
					value={selection.service}
					onChange={onServiceChange}
					onMakeDefault={onMakeDefaultSpace}
				/>
				{showRemotePodcastField ? (
					<PackageSessionRemotePodcastField
						id={`package-session-${sessionKey}-remote-podcast`}
						checked={selection.remotePodcast}
						disabled={savingSessionKey !== null}
						onCheckedChange={onRemotePodcastChange}
					/>
				) : null}
			</div>
			<BookingNotesField
				disabled={savingSessionKey !== null}
				value={selection.notes}
				onChange={onNotesChange}
			/>
			<div className="mt-6">
				<Button
					type="button"
					className={cn(
						"h-12 w-full rounded-lg",
						"text-base! font-bold! tracking-wider",
						"shadow-lg shadow-primary/45"
					)}
					disabled={isSaveDisabled}
					onClick={onRequestSaveSession}>
					{savingSessionKey === sessionKey ? (
						<LoaderCircle className="size-4 animate-spin" />
					) : null}
					{saveButtonText}
				</Button>
			</div>
		</Modal>
	);
}
