import { Button } from "#/components/ui/button";
import {
	openRequestCallModal,
	useBookingModalStore
} from "#studio/features/booking-form/lib/booking-modal-store";

const recurringSessionsPromptCopy = {
	prefix: "Need recurring sessions?",
	action: "Request a call",
	suffix: "to lock in your slot at a discounted rate."
} as const;

export function BookingRecurringSessionsPrompt() {
	const isRequestCallOpen = useBookingModalStore((state) => state.modal === "requestCall");

	return (
		<div className="text-left text-sm text-muted-foreground sm:text-center">
			{recurringSessionsPromptCopy.prefix}{" "}
			<Button
				type="button"
				variant="link"
				className="accent-link text-foreground p-0 font-medium"
				aria-haspopup="dialog"
				aria-expanded={isRequestCallOpen}
				onClick={openRequestCallModal}>
				{recurringSessionsPromptCopy.action}
			</Button>{" "}
			{recurringSessionsPromptCopy.suffix}
		</div>
	);
}
