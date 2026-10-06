import { err, okAsync, type Result, type ResultAsync } from "neverthrow";

export type AliasedResult = Result<number, "fixture error">;

export function importedResultHelper(): AliasedResult {
	return err("fixture error");
}

export function importedAsyncResultHelper(): ResultAsync<number, "fixture error"> {
	return okAsync(1);
}
