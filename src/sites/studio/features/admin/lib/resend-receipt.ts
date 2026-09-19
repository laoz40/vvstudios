import { toast } from "sonner";
import { tryCatch, type Result } from "#/lib/result";

type ResendReceiptEntityMessages = Partial<Record<string, string>>;

export async function resendReceiptWithFeedback({
	customerEmail,
	entityMessages,
	run
}: {
	customerEmail: string;
	entityMessages: ResendReceiptEntityMessages;
	run: () => Promise<Result<unknown, { reason: string }>>;
}) {
	const toastId = toast.loading("Sending receipt");

	const [error] = await tryCatch(run());

	if (error !== null) {
		const entityMessage = entityMessages[error.reason];

		if (entityMessage) {
			toast.error(entityMessage, { id: toastId });

			return;
		}

		const reason = error.reason;

		switch (reason) {
			case "NOT_AUTHENTICATED":
				toast.error("You are not signed in.", { id: toastId });

				return;
			case "NOT_AUTHORIZED":
				toast.error("You do not have access to resend receipts.", { id: toastId });

				return;
			case "RECEIPT_SEND_FAILED":
				toast.error("Unable to resend receipt.", { id: toastId });

				return;
			case "UNEXPECTED_ERROR":
				toast.error("Something went wrong while resending the receipt.", { id: toastId });

				return;
			default:
				toast.error("Unable to resend receipt.", { id: toastId });
		}
	}

	toast.success(`Receipt sent to ${customerEmail}.`, { id: toastId });
}
