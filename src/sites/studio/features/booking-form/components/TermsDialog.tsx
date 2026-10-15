import { LoaderCircle } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Modal } from "#studio/components/Modal";

const dialogTitle = "Terms & Conditions";

const dialogDescription = "Please review these terms before completing your booking.";

const cancelButtonLabel = "Cancel";

const confirmButtonLabel = "Agree & Book";

export const terms = [
	{ title: "1 - Payment", body: "Full payment is required upfront to secure all bookings." },
	{
		title: "2 - Damage & Liability",
		body: "Clients will be charged for any equipment or property damage during their session (excluding fair wear and tear). We are not responsible for left items or poor remote guest connections. To the extent permitted by law, liability for studio equipment failure or corrupted files is limited to a full refund or free reshoot. Nothing in these terms excludes, restricts or modifies rights or remedies that cannot lawfully be excluded under Australian Consumer Law."
	},
	{
		title: "3 - Cancellations & Rescheduling",
		body: "Payments are non-refundable for cancellations, change of mind, or no-shows (subject to Australian Consumer Law). Bookings may be rescheduled with a minimum of 12 hours notice."
	},
	{
		title: "4 - Conduct, Surveillance & Media",
		body: "Session times include setup and pack-down; late arrivals will not be extended. The studio is under video surveillance; sessions may be ended without refund for unsafe, illegal, or inappropriate behaviour. Unless requested otherwise, we may use session snippets or behind-the-scenes for promotion."
	},
	{
		title: "5 - Delivery & Revisions",
		body: "Delivered files expire and are permanently deleted after 7 days. Revisions must be requested within 2 business days of delivery (all clip feedback must be submitted together per round):\n\n• Rough Cut & Clip Volume Pack: 1 free revision (cuts, timing & text errors only).\n\n• Complete Edit & Handcrafted Clips: 2 free revisions (stylised changes allowed).\n\n• Clip Selection: Editors select the best moments unless timestamps are provided before editing begins; swapping chosen clips for completely new timestamps counts as a new order.\n\n• Extra Revisions: $50 per round (max 5 total)."
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
						<p className="leading-6 whitespace-pre-line text-muted-foreground">{item.body}</p>
					</section>
				))}
			</div>
		</Modal>
	);
}
