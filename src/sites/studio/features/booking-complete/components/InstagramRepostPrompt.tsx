import { useState, type ReactNode, type SubmitEvent } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { SavePackageInstagramHandleResult } from "#convex/packages";
import type { SaveSessionInstagramHandleResult } from "#convex/sessions";
import { tryCatch } from "#/lib/result";

type InstagramRepostTarget =
	| { kind: "booking"; stripeSessionId: string }
	| { kind: "multiBooking"; multiBookingId: Id<"multiBookingPackages"> };

type BookingInstagramSaveErrorReason =
	| NonNullable<SaveSessionInstagramHandleResult[0]>["reason"]
	| "UNEXPECTED_ERROR";
type MultiBookingInstagramSaveErrorReason =
	| NonNullable<SavePackageInstagramHandleResult[0]>["reason"]
	| "UNEXPECTED_ERROR";

export interface InstagramRepostPromptProps {
	target: InstagramRepostTarget;
}

export function InstagramRepostPrompt({ target }: InstagramRepostPromptProps): ReactNode {
	const [instagramHandle, setInstagramHandle] = useState("");
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const saveSessionInstagramHandle = useMutation(api.sessions.saveSessionInstagramHandle);
	const savePackageInstagramHandle = useMutation(api.packages.savePackageInstagramHandle);

	async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();

		const trimmedInstagramHandle = instagramHandle.trim();

		if (!trimmedInstagramHandle) {
			return;
		}

		setIsSubmitting(true);

		const wasSaved = await saveInstagramHandle(trimmedInstagramHandle);

		if (!wasSaved) {
			setIsSubmitting(false);
			return;
		}

		setIsSubmitted(true);
		toast.success("Thanks! We’ll keep an eye out for your post.");
		setIsSubmitting(false);
	}

	async function saveInstagramHandle(trimmedInstagramHandle: string): Promise<boolean> {
		if (target.kind === "multiBooking") {
			const [error] = await tryCatch<SavePackageInstagramHandleResult>(
				savePackageInstagramHandle({
					instagramHandle: trimmedInstagramHandle,
					multiBookingId: target.multiBookingId
				})
			);

			if (error !== null) {
				handleMultiBookingSaveError(error.reason);
				return false;
			}

			return true;
		}

		const [error] = await tryCatch<SaveSessionInstagramHandleResult>(
			saveSessionInstagramHandle({
				stripeSessionId: target.stripeSessionId,
				instagramHandle: trimmedInstagramHandle
			})
		);

		if (error !== null) {
			handleBookingSaveError(error.reason);
			return false;
		}

		return true;
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
					onSubmit={(event) => void handleSubmit(event)}>
					<Input
						aria-label="Instagram handle"
						disabled={isSubmitting || isSubmitted}
						placeholder="@yourhandle"
						value={instagramHandle}
						onChange={(event) => setInstagramHandle(event.target.value)}
					/>
					<Button
						type="submit"
						variant="secondary"
						className="sm:w-auto"
						disabled={isSubmitting || isSubmitted}>
						{isSubmitted ? "Submitted" : isSubmitting ? "Saving..." : "Submit"}
					</Button>
				</form>
			</div>
		</section>
	);
}

function handleBookingSaveError(reason: BookingInstagramSaveErrorReason) {
	switch (reason) {
		case "BOOKING_NOT_FOUND":
			toast.error("We could not find this booking. Please contact us if you need help.");
			return;
		case "BOOKING_NOT_CONFIRMED":
			toast.error("We can only save Instagram handles for confirmed bookings.");
			return;
		case "UNEXPECTED_ERROR":
			toast.error("Something went wrong while saving your Instagram handle.");
			return;
		default: {
			const _exhaustive: never = reason;
			void _exhaustive;
			return;
		}
	}
}

function handleMultiBookingSaveError(reason: MultiBookingInstagramSaveErrorReason) {
	switch (reason) {
		case "PACKAGE_NOT_FOUND":
			toast.error("We could not find this package request. Please contact us if you need help.");
			return;
		case "PACKAGE_NOT_ACTIVE":
			toast.error("We can only save Instagram handles for active package requests.");
			return;
		case "UNEXPECTED_ERROR":
			toast.error("Something went wrong while saving your Instagram handle.");
			return;
		default: {
			const _exhaustive: never = reason;
			void _exhaustive;
			return;
		}
	}
}
