import { useState, type ReactNode, type SubmitEvent } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";

import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";
import { api } from "#convex/_generated/api";
import type { SubmitFeedbackResult } from "#convex/feedback";
import { tryCatch } from "#/lib/result";
import { Modal } from "#studio/components/Modal";
import { closeModal, openFeedbackModal, useModalStore } from "#studio/lib/modal-store";

export function GiveFeedbackModalButton(): ReactNode {
	const open = useModalStore((state) => state.modal === "feedback");

	return (
		<Button
			type="button"
			variant="link"
			className="accent-link h-auto p-0 text-sm!"
			aria-haspopup="dialog"
			aria-expanded={open}
			onClick={openFeedbackModal}>
			Send feedback
		</Button>
	);
}

export function GiveFeedbackModal() {
	const [feedback, setFeedback] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const submitFeedback = useAction(api.feedback.submit);
	const canSubmit = feedback.trim().length > 0 && !isSubmitting;

	async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();

		if (!canSubmit) {
			return;
		}

		setIsSubmitting(true);

		const [error] = await tryCatch<SubmitFeedbackResult>(submitFeedback({ message: feedback }));

		if (error !== null) {
			switch (error.reason) {
				case "INVALID_MESSAGE":
					toast.error("Please enter some feedback before submitting.");
					break;

				case "FEEDBACK_RATE_LIMITED":
					toast.error("You’re sending feedback too quickly. Please try again later.");
					break;

				case "SEND_FAILED":
					toast.error("We couldn’t send your feedback. Please try again.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while sending your feedback.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsSubmitting(false);
			return;
		}

		setFeedback("");
		closeModal();
		toast.success("Thanks for your feedback!");
		setIsSubmitting(false);
	}

	return (
		<Modal
			open
			onOpenChange={closeModal}
			title="Give us your feedback"
			description="Tell us what you don't like or anything we could improve to make the studio or website experience better for you."
			closeLabel="Close feedback dialog"
			initialFocus="content"
			size="md">
			<form
				className="grid gap-4"
				onSubmit={(event) => void handleSubmit(event)}>
				<div className="grid gap-2">
					<label
						htmlFor="feedback-message"
						className="text-sm font-medium">
						Your feedback
					</label>
					<Textarea
						id="feedback-message"
						value={feedback}
						onChange={(event) => setFeedback(event.target.value)}
						placeholder="Tell us anything"
						rows={6}
						maxLength={2000}
					/>
				</div>
				<div className="flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={closeModal}>
						Cancel
					</Button>
					<Button
						type="submit"
						disabled={!canSubmit}>
						{isSubmitting ? "Sending..." : "Submit"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
