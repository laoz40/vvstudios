import { exhaustiveCheck } from "#/lib/result";
import type { ParsedAdminSearchQuery } from "#convex/shared/lib/adminSearch/adminSearchQuery";

export type AdminPackagePartialFieldSearchArgs = {
	indexName: "search_admin_name" | "search_admin_account" | "search_admin_ig";
	searchField: "name" | "accountName" | "instagramHandle";
	searchText: string;
};

export type AdminBookingPartialFieldSearchArgs =
	| AdminPackagePartialFieldSearchArgs
	| {
			indexName: "search_admin_editor";
			searchField: "assignedEditorDisplayName";
			searchText: string;
	  };

export type AdminPartialFieldSearchQuery = Exclude<
	ParsedAdminSearchQuery,
	| { kind: "blob" }
	| { kind: "email" }
	| { kind: "receipt" }
	| { kind: "phone" }
	| { kind: "abn" }
	| { kind: "date" }
>;

export type AdminBookingPartialFieldSearchQuery =
	| AdminPartialFieldSearchQuery
	| Extract<ParsedAdminSearchQuery, { kind: "editor" }>;

export function adminPartialFieldSearchArgs(
	parsedQuery: AdminPartialFieldSearchQuery
): AdminPackagePartialFieldSearchArgs;
export function adminPartialFieldSearchArgs(
	parsedQuery: AdminBookingPartialFieldSearchQuery
): AdminBookingPartialFieldSearchArgs;
export function adminPartialFieldSearchArgs(
	parsedQuery: AdminBookingPartialFieldSearchQuery
): AdminBookingPartialFieldSearchArgs {
	switch (parsedQuery.kind) {
		case "name":
			return { indexName: "search_admin_name", searchField: "name", searchText: parsedQuery.value };

		case "account":
			return {
				indexName: "search_admin_account",
				searchField: "accountName",
				searchText: parsedQuery.value
			};

		case "ig":
			return {
				indexName: "search_admin_ig",
				searchField: "instagramHandle",
				searchText: parsedQuery.value
			};

		case "editor":
			return {
				indexName: "search_admin_editor",
				searchField: "assignedEditorDisplayName",
				searchText: parsedQuery.value
			};

		default:
			return exhaustiveCheck(parsedQuery);
	}
}
