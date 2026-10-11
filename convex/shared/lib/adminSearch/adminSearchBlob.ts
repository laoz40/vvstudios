import type { Doc, Id } from "#convex/_generated/dataModel";
import { okAsync } from "neverthrow";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { normalizeAbn, normalizePhone } from "#convex/shared/lib/contactNormalization";
import { okOrThrow } from "#convex/shared/lib/result";

type BookingSearchBlobFields = Pick<
	Doc<"bookings">,
	"name" | "phone" | "accountName" | "abn" | "email" | "instagramHandle" | "receiptNumber" | "notes"
>;

type PackageSearchBlobFields = Pick<
	Doc<"packages">,
	"name" | "phone" | "accountName" | "abn" | "email" | "instagramHandle" | "receiptNumber" | "notes"
>;

type ContactSearchBlobFields = BookingSearchBlobFields | PackageSearchBlobFields;

function joinSearchStrings(strings: Array<string | undefined>): string {
	return strings
		.filter((value): value is string => value !== undefined && value.length > 0)
		.join(" ");
}

function contactSearchStrings(
	fields: ContactSearchBlobFields,
	extraStrings: Array<string | undefined> = []
): Array<string | undefined> {
	return [
		fields.name,
		fields.accountName,
		fields.email,
		normalizePhone(fields.phone),
		fields.abn ? normalizeAbn(fields.abn) : undefined,
		fields.instagramHandle,
		fields.receiptNumber,
		...extraStrings,
		fields.notes
	];
}

export function buildBookingSearchBlob(
	fields: BookingSearchBlobFields,
	options?: { assignedEditorDisplayName?: string }
): string {
	return joinSearchStrings(contactSearchStrings(fields, [options?.assignedEditorDisplayName]));
}

export function buildPackageSearchBlob(fields: PackageSearchBlobFields): string {
	return joinSearchStrings(contactSearchStrings(fields));
}

function loadAssignedEditorDisplayName(ctx: QueryCtx, tokenIdentifier: string) {
	return okOrThrow(
		ctx.db
			.query("editorProfiles")
			.withIndex("by_tokenIdentifier", (indexQuery) =>
				indexQuery.eq("tokenIdentifier", tokenIdentifier)
			)
			.unique()
			.then((editor) => {
				if (editor === null) {
					return undefined;
				}

				return editor.displayName || editor.email;
			})
	);
}

export type BookingSearchPatchOverrides = Partial<BookingSearchBlobFields> &
	Pick<Partial<Doc<"bookings">>, "assignedEditorTokenIdentifier" | "assignedEditorDisplayName">;

export type BookingSearchBlobPatch = { searchBlob: string; assignedEditorDisplayName?: string };

export function searchBlobPatchForBookingAsync(
	ctx: QueryCtx,
	booking: Doc<"bookings">,
	overrides: BookingSearchPatchOverrides = {}
) {
	const merged = { ...booking, ...overrides };

	if (!merged.assignedEditorTokenIdentifier) {
		return okAsync<BookingSearchBlobPatch>({
			searchBlob: buildBookingSearchBlob(merged),
			assignedEditorDisplayName: undefined
		});
	}

	if (
		merged.assignedEditorDisplayName !== undefined &&
		merged.assignedEditorDisplayName.length > 0
	) {
		return okAsync({
			searchBlob: buildBookingSearchBlob(merged, {
				assignedEditorDisplayName: merged.assignedEditorDisplayName
			}),
			assignedEditorDisplayName: merged.assignedEditorDisplayName
		});
	}

	return loadAssignedEditorDisplayName(ctx, merged.assignedEditorTokenIdentifier).map(
		(assignedEditorDisplayName) => ({
			searchBlob: buildBookingSearchBlob(merged, { assignedEditorDisplayName }),
			assignedEditorDisplayName
		})
	);
}

export async function searchBlobPatchForBooking(
	ctx: QueryCtx,
	booking: Doc<"bookings">,
	overrides: BookingSearchPatchOverrides = {}
) {
	const result = await searchBlobPatchForBookingAsync(ctx, booking, overrides);

	if (result.isErr()) {
		throw new Error("Booking search blob patch failed");
	}

	return result.value;
}

export function searchBlobPatchForPackage(
	packageRecord: Doc<"packages">,
	overrides: Partial<PackageSearchBlobFields> = {}
) {
	return { searchBlob: buildPackageSearchBlob({ ...packageRecord, ...overrides }) };
}

export type PackageContactSearchFields = Pick<
	Doc<"packages">,
	"name" | "phone" | "accountName" | "abn" | "email" | "instagramHandle"
>;

export type PackageSessionBookingContactSearchPatch = PackageContactSearchFields &
	Pick<Doc<"bookings">, "phone" | "searchBlob" | "assignedEditorDisplayName">;

export function buildPackageSessionBookingContactSearchPatch(
	ctx: QueryCtx,
	booking: Doc<"bookings">,
	contactFields: PackageContactSearchFields
) {
	const phone = normalizePhone(contactFields.phone);

	return searchBlobPatchForBookingAsync(ctx, booking, { ...contactFields, phone }).map(
		(searchBlobPatch) => ({ ...contactFields, phone, ...searchBlobPatch })
	);
}

export function patchPackageSessionBookingContactSearch(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	patch: PackageSessionBookingContactSearchPatch
) {
	return okOrThrow(ctx.db.patch("bookings", bookingId, patch).then(() => null));
}
