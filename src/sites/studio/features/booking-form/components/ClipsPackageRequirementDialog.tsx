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
				isClipsPackageDeselected
					? "The Clip Volume Pack requires the Essential Edit add-on."
					: "The Clip Volume Pack is available only with the Essential Edit add-on."
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
