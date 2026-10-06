import type {
	ApiFromModules,
	FunctionReference,
	FunctionReturnType,
	FunctionType,
	FunctionVisibility
} from "convex/server";
import type { Err, Ok, ResultAsync } from "neverthrow";
import type { api, internal } from "../../convex/_generated/api";
import type * as fixtureModule from "./neverthrow-fixtures/endpoints";

type Assert<T extends true> = T;

type Equal<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

type IsAny<Value> = 0 extends 1 & Value ? true : false;

type ContainsNeverthrow<Value> =
	IsAny<Value> extends true
		? true
		: Value extends Ok<unknown, unknown> | Err<unknown, unknown> | ResultAsync<unknown, unknown>
			? true
			: Value extends string | number | bigint | boolean | null | undefined
				? false
				: Value extends readonly (infer Item)[]
					? ContainsNeverthrow<Item>
					: Value extends object
						? { [Key in keyof Value]: ContainsNeverthrow<Value[Key]> }[keyof Value]
						: false;

type BadEndpointPaths<EndpointTree, Prefix extends string = ""> =
	EndpointTree extends FunctionReference<FunctionType, FunctionVisibility>
		? FunctionReturnType<EndpointTree> extends infer Return
			? IsAny<Awaited<Return>> extends true
				? Prefix
				: true extends ContainsNeverthrow<Awaited<Return>>
					? Prefix
					: never
			: never
		: {
				[Key in keyof EndpointTree & string]: BadEndpointPaths<
					EndpointTree[Key],
					Prefix extends "" ? Key : `${Prefix}.${Key}`
				>;
			}[keyof EndpointTree & string];

type GeneratedPublicBadPaths = BadEndpointPaths<typeof api>;

type GeneratedInternalBadPaths = BadEndpointPaths<typeof internal>;

type FixtureApi = ApiFromModules<{ "type-contract-fixtures/endpoints": typeof fixtureModule }>;

type FixtureBadPaths = BadEndpointPaths<FixtureApi>;

// These expectations prove the contract sees real neverthrow values after Convex's
// FunctionReferenceFromExport / ConvertReturnType transformation, including ResultAsync.
// Explicit `any` endpoint returns also fail this check. Coverage follows generated api.d.ts,
// so regenerate it first; an endpoint missing from stale generated output cannot be inspected.
export type PublicEndpointsRejectNeverthrow = Assert<Equal<GeneratedPublicBadPaths, never>>;

export type InternalEndpointsRejectNeverthrow = Assert<Equal<GeneratedInternalBadPaths, never>>;

export type FixtureDetectsKnownBadEndpoints = Assert<
	Equal<
		FixtureBadPaths,
		| "type-contract-fixtures.endpoints.directResult"
		| "type-contract-fixtures.endpoints.importedHelperResult"
		| "type-contract-fixtures.endpoints.asyncResult"
		| "type-contract-fixtures.endpoints.resultAsync"
		| "type-contract-fixtures.endpoints.importedResultAsync"
		| "type-contract-fixtures.endpoints.aliasedResult"
		| "type-contract-fixtures.endpoints.importedOkAsync"
		| "type-contract-fixtures.endpoints.asyncErrAsync"
		| "type-contract-fixtures.endpoints.resultOrNull"
		| "type-contract-fixtures.endpoints.untypedReturn"
		| "type-contract-fixtures.endpoints.asyncUntypedReturn"
		| "type-contract-fixtures.endpoints.nestedResult"
		| "type-contract-fixtures.endpoints.resultArray"
	>
>;
