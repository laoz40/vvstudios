import { err, ok, ResultAsync } from "neverthrow";
import type { Result as ConvexResult } from "#/lib/result";

/** Wraps a promise as a ResultAsync while allowing unexpected rejections to escape. */
export function okOrThrow<T>(promise: Promise<T>) {
	return ResultAsync.fromSafePromise(promise);
}

/** Converts a serialized Result returned by a Convex function into neverthrow. */
export function fromConvexResult<P extends Promise<ConvexResult<unknown, { reason: string }>>>(
	promise: P
): ResultAsync<ConvexSuccess<Awaited<P>>, ConvexError<Awaited<P>>>;
export function fromConvexResult(promise: Promise<ConvexResult<unknown, { reason: string }>>) {
	return ResultAsync.fromSafePromise(promise).andThen(([error, value]) =>
		error !== null ? err(error) : ok(value)
	);
}

type ConvexSuccess<R> = R extends readonly [null, infer Success] ? Success : never;
type ConvexError<R> = R extends readonly [infer Error extends { reason: string }, null]
	? Error
	: never;
