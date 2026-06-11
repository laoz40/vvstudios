export type Result<S, E extends { reason: string }> =
	| [error: E, data: null]
	| [error: null, data: S];

export function ok<S>(data: S): Result<S, never> {
	return [null, data];
}

export function err<const R extends string, E extends { reason: R }>(error: E): Result<never, E> {
	return [error, null];
}

export type UnexpectedError = { reason: "UNEXPECTED_ERROR" };

export async function tryCatch<R extends Result<unknown, { reason: string }>>(
	promise: Promise<R>
): Promise<R | Result<never, UnexpectedError>> {
	try {
		return await promise;
	} catch {
		return err({ reason: "UNEXPECTED_ERROR" });
	}
}
