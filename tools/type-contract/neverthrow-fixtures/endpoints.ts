import type { RegisteredQuery } from "convex/server";
import { v } from "convex/values";
import { err, errAsync, ok, okAsync } from "neverthrow";
import { internalQuery, query } from "../../../convex/_generated/server";
import { importedAsyncResultHelper, importedResultHelper, type AliasedResult } from "./helper";

type FixtureError = { reason: "fixture" };

type TupleResult<T, E> = [E, null] | [null, T];

export const directResult = query({ args: {}, handler: () => ok(1) });

export const importedHelperResult = query({ args: {}, handler: () => importedResultHelper() });

export const asyncResult = query({
	args: {},
	handler: async () => await Promise.resolve(err<never, FixtureError>({ reason: "fixture" }))
});

export const resultAsync = query({ args: {}, handler: () => okAsync(1) });

export const importedResultAsync = internalQuery({
	args: {},
	handler: () => importedAsyncResultHelper()
});

export const aliasedResult = query({
	args: {},
	handler: (): AliasedResult => err("fixture error")
});

export const plainValue = query({ args: {}, handler: () => "valid" });

export const tupleResult = query({
	args: {},
	handler: (): TupleResult<number, string> => [null, 1]
});

export const paginatedValue = query({
	args: {},
	handler: () => ({ page: [1], isDone: true, continueCursor: "" })
});

export const importedOkAsync = query({ args: {}, handler: () => okAsync("ok") });

export const asyncErrAsync = query({ args: {}, handler: async () => errAsync("bad") });

export const resultOrNull = query({
	args: { succeed: v.boolean() },
	handler: (_ctx, args) => (args.succeed ? ok(1) : null)
});

export const nestedResult = query({
	args: {},
	handler: () => ({ checkout: importedResultHelper() })
});

export const resultArray = query({ args: {}, handler: () => [ok(1), null] });

// Model an external API's untyped return without executing unsafe fixture code.
export declare const untypedReturn: RegisteredQuery<
	"public",
	Record<string, never>,
	ReturnType<typeof JSON.parse>
>;

export declare const asyncUntypedReturn: RegisteredQuery<
	"public",
	Record<string, never>,
	Promise<ReturnType<typeof JSON.parse>>
>;
