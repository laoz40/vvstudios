import { err, ok, ResultAsync } from "neverthrow";
import type { Result as ConvexResult } from "#/lib/result";

/** Wraps a promise as a ResultAsync while allowing unexpected rejections to escape. */
export function okOrThrow<T>(promise: Promise<T>) {
	return ResultAsync.fromSafePromise<T>(promise);
}

/** Converts a serialized Result returned by a Convex function into neverthrow. */
export function fromConvexTuple<P extends Promise<ConvexResult<unknown, { reason: string }>>>(
	promise: P
): ResultAsync<ConvexSuccess<Awaited<P>>, ConvexError<Awaited<P>>>;
export function fromConvexTuple(promise: Promise<ConvexResult<unknown, { reason: string }>>) {
	return ResultAsync.fromSafePromise<ConvexResult<unknown, { reason: string }>>(promise).andThen(
		([error, value]) => (error !== null ? err(error) : ok(value))
	);
}

type ConvexSuccess<R> = R extends readonly [infer Error, infer Success]
	? Error extends null
		? Success
		: never
	: never;
type ConvexError<R> = R extends readonly [infer Error, unknown]
	? Error extends { reason: string }
		? Error
		: never
	: never;
