import { createPortal } from "react-dom";
import type { RefObject } from "react";
import { Label } from "#/components/ui/label";
import { Checkbox } from "#/components/ui/checkbox";
import { Field, FieldContent } from "#/components/ui/field";
import { BookingSavedInfoBanner } from "#studio/features/booking-form/components/BookingSavedInfoBanner";
import type { BookingFormApi } from "#studio/features/booking-form/lib/booking-form-context";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";
import { useSavedBookingInfo } from "#studio/features/booking-form/hooks/useSavedBookingInfo";

type BookingSavedInfoControlsProps = {
	bannerMount: HTMLDivElement | null;
	formApi: BookingFormApi;
	onReuseSavedBookingInfo: () => void;
	persistBookingInfoRef: RefObject<(value: BookingFormValues) => void>;
};

export function BookingSavedInfoControls({
	bannerMount,
	formApi,
	onReuseSavedBookingInfo,
	persistBookingInfoRef
}: BookingSavedInfoControlsProps) {
	const savedBookingInfo = useSavedBookingInfo({ formApi, onReuseSavedBookingInfo });

	persistBookingInfoRef.current = savedBookingInfo.persistBookingInfoFromForm;

	const banner =
		savedBookingInfo.savedBookingInfo && bannerMount
			? createPortal(
					<BookingSavedInfoBanner
						onRemove={savedBookingInfo.handleRemoveSavedBookingInfo}
						onReuse={savedBookingInfo.handleReuseSavedBookingInfo}
					/>,
					bannerMount
				)
			: null;

	return (
		<>
			{banner}
			<Field
				orientation="horizontal"
				className="items-center! gap-2">
				<Checkbox
					id="save-booking-info"
					checked={savedBookingInfo.shouldSaveBookingInfo}
					className="size-5 rounded-full data-[state=checked]:border-transparent"
					onCheckedChange={(checked) =>
						savedBookingInfo.handleSaveBookingInfoChange(checked === true)
					}
				/>
				<FieldContent className="justify-center gap-0">
					<Label
						htmlFor="save-booking-info"
						className="cursor-pointer text-sm">
						Save booking information on this device for next time
					</Label>
				</FieldContent>
			</Field>
		</>
	);
}
