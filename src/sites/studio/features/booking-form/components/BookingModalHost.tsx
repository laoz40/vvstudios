import { Button } from "#/components/ui/button";
import { Modal } from "#studio/components/Modal";
import {
	closeBookingModal,
	useBookingModalStore
} from "#studio/features/booking-form/lib/booking-modal-store";

export function BookingModalHost() {
	const modal = useBookingModalStore((state) => state.modal);

	switch (modal) {
		case "addonCompatibility":
			return (
				<Modal
					open
					onOpenChange={closeBookingModal}
					title="4K isn't available for remote podcasts"
					description="Remote Podcast runs through Riverside.fm using our studio setup, which doesn't support our 4K recording addon."
					closeLabel="Close"
					footer={
						<Button
							type="button"
							onClick={closeBookingModal}>
							Got it
						</Button>
					}
				/>
			);

		case "none":
			return null;

		default: {
			const _exhaustive: never = modal;
			return _exhaustive;
		}
	}
}
