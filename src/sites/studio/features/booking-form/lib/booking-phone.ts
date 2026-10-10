import { z } from "zod";
import { normalizePhone } from "#convex/shared/lib/contactNormalization";

const bookingPhoneInputSchema = z
	.string()
	.trim()
	.min(1, "Phone number is required.")
	.pipe(z.string().regex(/^[\d\s().+-]{6,20}$/, "Please enter a valid phone number."));

export function parseCanonicalPhoneForStorage(phone: string): string {
	const parsed = bookingPhoneInputSchema.safeParse(phone);

	if (!parsed.success) {
		throw new Error(parsed.error.issues[0]?.message ?? "Please enter a valid phone number.");
	}

	return normalizePhone(parsed.data);
}

export const bookingPhoneSchema = bookingPhoneInputSchema.transform((value) =>
	normalizePhone(value)
);
