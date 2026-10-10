import { err, ok, type Result } from "neverthrow";

export function parseFeedbackMessage(
	message: string
): Result<string, { reason: "INVALID_MESSAGE" }> {
	const trimmed = message.trim();

	return trimmed ? ok(trimmed) : err({ reason: "INVALID_MESSAGE" });
}
