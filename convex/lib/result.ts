import { err, ok, type Result, ResultAsync } from "neverthrow";
import type { Result as ConvexResult } from "#/lib/result";

/** Wraps a promise as a ResultAsync while allowing unexpected rejections to escape. */
export function okOrThrow<T>(promise: Promise<T>) {
	return ResultAsync.fromSafePromise<T>(promise);
}

/** Chains a Promise that already resolves to a Result (not Convex I/O at the call site). */
export function promiseResult<T, E>(promise: Promise<Result<T, E>>) {
	return ResultAsync.fromSafePromise(promise).andThen((result) =>
		result.isErr() ? err(result.error) : ok(result.value)
	);
}

/** Wrap async work that is not Convex I/O (crypto, DNS, legacy async lib). Prefer `ResultAsync` lib functions. */
export function liftPromise<T>(promise: Promise<T>) {
	return ResultAsync.fromSafePromise<T>(promise);
}

type TryPromiseOptions<T, E> = { try: () => Promise<T>; catch: (cause: unknown) => E };

/** Maps expected promise failures into domain errors. Sync throws in `try` are caught too. */
export function tryPromise<T, E>(options: TryPromiseOptions<T, E>): ResultAsync<T, E> {
	return ResultAsync.fromPromise(Promise.resolve().then(options.try), options.catch);
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
