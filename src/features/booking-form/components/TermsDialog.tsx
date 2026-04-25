import { useId } from "react";
import { LoaderCircle, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Dialog } from "radix-ui";

const dialogTitle = "Terms & Conditions";
const dialogDescription = "Please review these terms before completing your booking.";
const cancelButtonLabel = "Cancel";
const confirmButtonLabel = "Agree & Book";
const loadingLabel = "Preparing...";

const terms = [
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
	const descriptionId = useId();

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(nextOpen) => {
				if (isSubmitting && !nextOpen) {
					return;
				}

				onOpenChange(nextOpen);
			}}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
				<Dialog.Content
					aria-describedby={descriptionId}
					className="bg-popover text-popover-foreground ring-foreground/10 fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-1.5rem)] max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl p-4 text-sm outline-none ring-1 max-h-[calc(100vh-2rem)] sm:max-w-2xl sm:p-6"
					onInteractOutside={(event) => {
						if (isSubmitting) {
							event.preventDefault();
						}
					}}
					onEscapeKeyDown={(event) => {
						if (isSubmitting) {
							event.preventDefault();
						}
					}}>
					<Dialog.Close asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="absolute top-2 right-2"
							aria-label="Close terms dialog">
							<X />
						</Button>
					</Dialog.Close>

					<div className="space-y-2">
						<Dialog.Title className="text-xl font-semibold">{dialogTitle}</Dialog.Title>
						<Dialog.Description
							id={descriptionId}
							className="text-muted-foreground text-sm leading-6">
							{dialogDescription}
						</Dialog.Description>
					</div>

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

					<div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
