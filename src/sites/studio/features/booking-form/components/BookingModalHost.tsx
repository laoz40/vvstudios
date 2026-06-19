import { Button } from "#/components/ui/button";
import { env } from "#/env";
import { Modal } from "#studio/components/Modal";
import {
	closeBookingModal,
	useBookingModalStore
} from "#studio/features/booking-form/lib/booking-modal-store";

export function BookingModalHost() {
	const bookingModalState = useBookingModalStore((state) => state);

	switch (bookingModalState.modal) {
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
							className="w-full"
							onClick={closeBookingModal}>
							Got it
						</Button>
					}
				/>
			);

		case "requestCall":
			return (
				<Modal
					open
					onOpenChange={closeBookingModal}
					title="Request a call"
					description="Book a quick call to discuss recurring sessions and availability."
					closeLabel="Close"
					initialFocus="content"
					size="6xl"
					className="max-h-[calc(100vh-2rem)] overflow-y-auto">
					<div className="overflow-hidden rounded-xl border bg-white">
						<iframe
							src={env.VITE_BOOKING_RECURRING_URL}
							title="Request a call"
							className="block min-h-176 w-full border-0 bg-transparent"
						/>
					</div>
				</Modal>
			);

		case "sessionSummary":
			return (
				<Modal
					open
					onOpenChange={closeBookingModal}
					title={
						<span className="text-muted-foreground block text-center text-lg font-medium">
							Selected Session
						</span>
					}
					closeLabel="Close dialog"
					className="gap-4 px-6 py-4 sm:px-8"
					footer={
						<Button
							type="button"
							className="mt-4 w-full"
							onClick={closeBookingModal}>
							Confirm
						</Button>
					}>
					<div className="space-y-2 text-center">
						<p className="text-foreground text-3xl font-semibold tracking-tight">
							{bookingModalState.dateSummary}
						</p>
						<p className="text-xl font-medium">{bookingModalState.timeSummary}</p>
					</div>
				</Modal>
			);

		case "none":
			return null;

		default: {
			const _exhaustive: never = bookingModalState;
			return _exhaustive;
		}
	}
}
