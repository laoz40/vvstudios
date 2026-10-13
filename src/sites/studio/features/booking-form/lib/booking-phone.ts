import { z } from "zod";
import { normalizePhone } from "#convex/shared/lib/contactNormalization";

const bookingPhoneInputSchema = z
	.string()
	.trim()
	.min(1, "Phone number is required.")
	.pipe(z.string().regex(/^[\d\s().+-]{6,20}$/, "Please enter a valid phone number."));

export const bookingPhoneSchema = bookingPhoneInputSchema.transform((value) =>
	normalizePhone(value)
);
