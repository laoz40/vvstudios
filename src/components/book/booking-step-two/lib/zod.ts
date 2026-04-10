import { z } from "zod";
import type { BookingErrors, BookingField, BookingFormData } from "./form-types";

export const BookingSchema = z.object({
  date: z.string().min(1, "Please select a booking date."),
  duration: z.string().min(1, "Please select a session duration."),
  videoFormat: z.string().min(1, "Please select a recording format."),
  questionsOrRequests: z
    .string()
    .trim()
    .max(200, "Please keep this under 200 characters.")
    .optional(),
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required.")
    .max(50, "Name must be 50 characters or fewer.")
    .regex(/^[\p{L}\p{M}' ,-]+$/u, "Name contains invalid characters."),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required.")
    .regex(/^[\d\s().+\-]{6,20}$/, "Please enter a valid phone number."),
  accountName: z
    .string()
    .trim()
    .min(1, "Account name is required.")
    .max(50, "Account name must be 50 characters or fewer.")
    .regex(/^[\p{L}\p{M}' ,.()-]+$/u, "Account name contains invalid characters."),
  abn: z
    .string()
    .trim()
    .transform((val) => (val === "" ? undefined : val))
    .optional()
    .transform((val) => val?.replace(/\s+/g, ""))
    .refine((val) => !val || /^\d{11}$/.test(val), {
      message: "ABN must be exactly 11 digits.",
    }),
  email: z.email("Please enter a valid email address."),
});

export function getFieldErrors(error: z.ZodError<BookingFormData>): BookingErrors {
  const fieldErrors: BookingErrors = {};

  for (const issue of error.issues) {
    const key = issue.path[0] as BookingField | undefined;
    if (key && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}
