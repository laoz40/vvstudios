import { ResultAsync } from "neverthrow";

/**
 * Wraps an operation whose success value is not needed and converts that value to Convex-safe null.
 * Promise rejections remain unexpected failures and reject the ResultAsync chain.
 */
export function nullResult(promise: Promise<unknown>) {
	return ResultAsync.fromSafePromise(promise.then(() => null));
}
