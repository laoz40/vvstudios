import { ResultAsync } from "neverthrow";

/** Wraps a promise as a ResultAsync while allowing unexpected rejections to escape. */
export function okOrThrow<T>(promise: Promise<T>) {
	return ResultAsync.fromSafePromise(promise);
}
