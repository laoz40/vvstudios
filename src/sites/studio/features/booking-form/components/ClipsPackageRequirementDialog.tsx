import { Button } from "#/components/ui/button";
import { Modal } from "#studio/components/Modal";
import { closeBookingModal } from "#studio/features/booking-form/lib/booking-modal-store";

type ClipsPackageRequirementDialogProps = { reason: "clipsDeselected" | "selectionBlocked" };

export function ClipsPackageRequirementDialog({ reason }: ClipsPackageRequirementDialogProps) {
	const isClipsPackageDeselected = reason === "clipsDeselected";

	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open) {
					closeBookingModal();
				}
			}}
			title={isClipsPackageDeselected ? "Clip Volume Pack removed" : "Essential Edit required"}
			description={
				<div className="flex flex-col gap-2">
					<p>
						The Clip Volume Pack requires the Essential Edit add-on. This is because the footage
						must be combined before creating clips.
					</p>
					<p>{"Handcrafted Clips don't require an Essential Edit."}</p>
				</div>
			}
			closeLabel="Close dialog"
			footer={
				<Button
					type="button"
					className="w-full"
					onClick={closeBookingModal}>
					Got it
				</Button>
			}
		/>
	);
}
