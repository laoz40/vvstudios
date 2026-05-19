import { LoaderCircle } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Modal } from "#studio/components/Modal";

const dialogTitle = "Terms & Conditions";
const dialogDescription = "Please review these terms before completing your booking.";
const cancelButtonLabel = "Cancel";
const confirmButtonLabel = "Agree & Book";
const loadingLabel = "Preparing...";

export const terms = [
	{
		title: "1 - Payment",
		body: "A non-refundable deposit is required to secure all bookings. The remaining balance must be paid before or on the day of the session. No video or audio files will be delivered until full payment is received.",
	},
	{
		title: "2 - Damage & Liability",
		body: "Clients are responsible for any damage caused to studio equipment or property during their session, excluding reasonable wear and tear. Repair or replacement costs will be charged accordingly.",
	},
	{
		title: "3 - Cancellations & Rescheduling",
		body: "Deposits are non-refundable. Bookings may be rescheduled with a minimum of 24 hours notice. Late cancellations or no-shows will forfeit the deposit.",
	},
	{
		title: "4 - Session Conduct & Surveillance",
		body: "Clients must arrive on time and behave respectfully. The studio is monitored by video surveillance for safety and security. The studio reserves the right to end a session without refund in cases of unsafe, illegal, or inappropriate behaviour.",
	},
	{
		title: "5 - Delivery & Revisions",
		body: "All content will be delivered after full payment has been received. Base edits include up to 3 revision rounds, limited to corrections (e.g. cuts, timing, errors). Additional revisions or creative changes will be charged separately.",
	},
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
						{isSubmitting ? (
							<span className="flex items-center justify-center gap-2">
								<LoaderCircle className="size-4 animate-spin" />
								<span>{loadingLabel}</span>
							</span>
						) : (
							confirmButtonLabel
						)}
					</Button>
				</>
			}>
			<div className="bg-card space-y-4 rounded-lg border p-4 text-sm">
				{terms.map((item) => (
					<section
						key={item.title}
						className="space-y-1.5">
						<h3 className="text-foreground font-semibold">{item.title}</h3>
						<p className="text-muted-foreground leading-6">{item.body}</p>
					</section>
				))}
			</div>
		</Modal>
	);
}
