import { useState, type ReactNode, type SubmitEvent } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { api } from "#convex/_generated/api";

export interface InstagramRepostPromptProps {
	stripeSessionId: string;
}

export function InstagramRepostPrompt({ stripeSessionId }: InstagramRepostPromptProps): ReactNode {
	const [instagramHandle, setInstagramHandle] = useState("");
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const saveBookingInstagramHandle = useMutation(api.bookings.saveBookingInstagramHandle);

	async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();

		const trimmedInstagramHandle = instagramHandle.trim();

		if (!trimmedInstagramHandle) {
			return;
		}

		setIsSubmitting(true);

		try {
			await saveBookingInstagramHandle({
				stripeSessionId,
				instagramHandle: trimmedInstagramHandle,
			});
			setIsSubmitted(true);
			toast.success("Thanks! We’ll keep an eye out for your post.");
		} catch {
			toast.error("Unable to save your Instagram handle. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<section className="rounded-lg border bg-background/60 p-4 shadow-sm">
			<div className="flex flex-col gap-3">
				<div className="flex flex-col gap-1">
					<h2 className="text-base font-semibold">Posting your studio content on Instagram?</h2>
					<p className="text-sm leading-normal text-muted-foreground">
						Send us your Instagram handle. If you post content made at VV Studios, we can repost it
						and help give your work free advertising.
					</p>
				</div>
				<form
					className="flex flex-col gap-2 sm:flex-row"
					onSubmit={handleSubmit}>
					<Input
						aria-label="Instagram handle"
						disabled={isSubmitting || isSubmitted}
						placeholder="@yourhandle"
						value={instagramHandle}
						onChange={(event) => setInstagramHandle(event.target.value)}
					/>
					<Button
						type="submit"
						className="sm:w-auto"
						disabled={isSubmitting || isSubmitted}>
						{isSubmitted ? "Submitted" : isSubmitting ? "Saving..." : "Submit"}
					</Button>
				</form>
			</div>
		</section>
	);
}
