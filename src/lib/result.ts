export type Result<S, E extends { reason: string }> =
	| [error: E, data: null]
	| [error: null, data: S];

export function tupleOk<const S>(data: S): Result<S, never> {
	return [null, data];
}

export function tupleErr<const E extends { reason: string }>(error: E): Result<never, E> {
	return [error, null];
}

export type UnexpectedError = { reason: "UNEXPECTED_ERROR" };

export async function tryCatch<R extends Result<unknown, { reason: string }>>(
	promise: Promise<R>
): Promise<R | Result<never, UnexpectedError>> {
	try {
		return await promise;
	} catch {
		return tupleErr({ reason: "UNEXPECTED_ERROR" });
	}
}
