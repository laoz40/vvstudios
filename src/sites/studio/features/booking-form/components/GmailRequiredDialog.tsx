import { Button } from "#/components/ui/button";
import { Modal } from "#studio/components/Modal";
import { closeBookingModal } from "#studio/features/booking-form/lib/booking-modal-store";

const gmailRequiredCopy = {
	title: "Gmail required",
	description:
		"A Gmail address is required to receive your invoice and deliverables via Drive. Use the same email for each booking so your deliverables can stay together.",
	confirmLabel: "Got it"
} as const;

export function GmailRequiredDialog() {
	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open) {
					closeBookingModal();
				}
			}}
			title={gmailRequiredCopy.title}
			description={gmailRequiredCopy.description}
			closeLabel="Close dialog"
			footer={
				<Button
					type="button"
					className="w-full"
					onClick={closeBookingModal}>
					{gmailRequiredCopy.confirmLabel}
				</Button>
			}
		/>
	);
}
