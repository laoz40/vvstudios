export type LogContext = {
	operation: string;
	[key: string]: string | number | boolean | null | undefined;
};

/** Log an operational failure once, where it is caught, with selected diagnostic context. */
export function logError(context: LogContext & { reason: string }, cause?: unknown) {
	const error =
		cause instanceof Error
			? { name: cause.name, message: cause.message, stack: cause.stack }
			: cause;

	console.error({ ...context, cause: error });
}
