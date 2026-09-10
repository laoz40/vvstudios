import { z } from "zod";

/** Parse one optional search field without failing sibling fields. */
export function searchOptionalField<T extends z.ZodType>(schema: T) {
	return z.preprocess((value) => {
		const parsed = schema.safeParse(value);

		return parsed.success ? parsed.data : undefined;
	}, schema.optional());
}
