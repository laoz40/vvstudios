import { LoaderCircle } from "lucide-react";
import { Button } from "#/components/ui/button";
import { BOOKING_RECEIPT_NOTES } from "#studio/features/booking-invoice/lib/constants";
import { formatNoticeWindowLabel } from "#studio/features/booking-form/lib/package-scheduling-rules";
import { Modal } from "#studio/components/Modal";
import { DEFAULT_BOOKING_AVAILABILITY_SETTINGS } from "#studio/lib/bookingAvailabilitySettings";

const dialogTitle = "Terms & Conditions";

const dialogDescription = "Please review these terms before completing your booking.";

const cancelButtonLabel = "Cancel";

const confirmButtonLabel = "Agree & Book";

const defaultNoticeWindowLabel = formatNoticeWindowLabel(
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS.leadTimeMinutes
);

export const terms = [
	{ title: "1 - Payment", body: "Full payment is required upfront to secure all bookings." },
	{
		title: "2 - Damage & Liability",
		body: "Clients are responsible for any damage caused to studio equipment or property during their session, excluding reasonable wear and tear. Repair or replacement costs will be charged accordingly."
	},
	{
		title: "3 - Cancellations & Rescheduling",
		body: BOOKING_RECEIPT_NOTES.getCancellationPolicy(defaultNoticeWindowLabel)
	},
	{
		title: "4 - Session Conduct & Surveillance",
		body: "Clients must arrive on time and behave respectfully. The studio is monitored by video surveillance for safety and security. The studio reserves the right to end a session without refund in cases of unsafe, illegal, or inappropriate behaviour."
	},
	{
		title: "5 - Delivery & Revisions",
		body: "All content will be delivered after your session. Base edits include up to 3 revision rounds, limited to corrections (e.g. cuts, timing, errors). Additional revisions or creative changes will be charged separately."
	}
] as const;

export interface TermsDialogProps {
	isSubmitting: boolean;
	onConfirm: () => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function TermsDialog({ isSubmitting, onConfirm, open, onOpenChange }: TermsDialogProps) {
	return (
		<Modal
			open={open}
			onOpenChange={(nextOpen) => {
				if (isSubmitting && !nextOpen) {
					return;
				}

				onOpenChange(nextOpen);
			}}
			title={dialogTitle}
			description={dialogDescription}
			closeLabel="Close terms dialog"
			preventClose={isSubmitting}
			size="2xl"
			className="max-h-[calc(100vh-2rem)] overflow-y-auto"
			footer={
				<>
					<Button
						type="button"
						variant="outline"
						className="rounded-lg"
						disabled={isSubmitting}
						onClick={() => {
							onOpenChange(false);
						}}>
						{cancelButtonLabel}
					</Button>
					<Button
						type="button"
						className="rounded-lg"
						disabled={isSubmitting}
						onClick={onConfirm}>
						{isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{isSubmitting ? "Booking..." : confirmButtonLabel}
					</Button>
				</>
			}>
			<div className="space-y-4 rounded-lg border bg-card p-4 text-sm">
				{terms.map((item) => (
					<section
						key={item.title}
						className="space-y-1.5">
						<h3 className="font-semibold text-foreground">{item.title}</h3>
						<p className="leading-6 text-muted-foreground">{item.body}</p>
					</section>
				))}
			</div>
		</Modal>
	);
}
