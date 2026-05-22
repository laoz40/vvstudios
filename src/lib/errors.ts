export type Result<S, E extends { code: string }> = [E, null] | [null, S];

export function ok<S>(value: S): Result<S, never> {
	return [null, value];
}

export function err<const C extends string, E extends { code: C }>(error: E): Result<never, E> {
	return [error, null];
}
