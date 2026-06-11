import { useState, type ReactNode, type SubmitEvent } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { api } from "#convex/_generated/api";
import type { SaveBookingInstagramHandleResult } from "#convex/bookings";
import { tryCatch } from "#/lib/result";
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

		const [error] = await tryCatch<SaveBookingInstagramHandleResult>(
			saveBookingInstagramHandle({ stripeSessionId, instagramHandle: trimmedInstagramHandle })
		);

		if (error !== null) {
			switch (error.reason) {
				case "BOOKING_NOT_FOUND":
					toast.error("We could not find this booking. Please contact us if you need help.");
					break;

				case "BOOKING_NOT_CONFIRMED":
					toast.error("We can only save Instagram handles for confirmed bookings.");
					break;

				case "BOOKING_INSTAGRAM_HANDLE_SAVE_FAILED":
					toast.error("Could not save your Instagram handle. Please try again.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while saving your Instagram handle.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsSubmitting(false);
			return;
		}

		setIsSubmitted(true);
		toast.success("Thanks! We’ll keep an eye out for your post.");
		setIsSubmitting(false);
	}

	return (
		<section className="rounded-lg border bg-background/60 p-4 shadow-sm">
			<div className="flex flex-col gap-3">
				<div className="flex flex-col gap-1">
					<h2 className="text-base font-semibold">Want us to share your content?</h2>
					<p className="text-sm leading-normal text-muted-foreground">
						Leave your Instagram handle below. When you post content from your session, we can
						repost it to our audience and help spread the word.
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
