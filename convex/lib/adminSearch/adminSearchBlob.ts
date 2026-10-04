import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { normalizeAbn, normalizePhone } from "#convex/lib/contactNormalization";

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

async function getAssignedEditorDisplayName(ctx: QueryCtx, tokenIdentifier: string) {
	const editor = await ctx.db
		.query("editorProfiles")
		.withIndex("by_tokenIdentifier", (indexQuery) =>
			indexQuery.eq("tokenIdentifier", tokenIdentifier)
		)
		.unique();

	if (editor === null) {
		return undefined;
	}

	return editor.displayName || editor.email;
}

export type BookingSearchPatchOverrides = Partial<BookingSearchBlobFields> &
	Pick<Partial<Doc<"bookings">>, "assignedEditorTokenIdentifier" | "assignedEditorDisplayName">;

export async function searchBlobPatchForBooking(
	ctx: QueryCtx,
	booking: Doc<"bookings">,
	overrides: BookingSearchPatchOverrides = {}
) {
	const merged = { ...booking, ...overrides };
	let assignedEditorDisplayName: string | undefined;

	if (!merged.assignedEditorTokenIdentifier) {
		return { searchBlob: buildBookingSearchBlob(merged), assignedEditorDisplayName: undefined };
	}

	if (
		merged.assignedEditorDisplayName !== undefined &&
		merged.assignedEditorDisplayName.length > 0
	) {
		assignedEditorDisplayName = merged.assignedEditorDisplayName;
	} else {
		assignedEditorDisplayName = await getAssignedEditorDisplayName(
			ctx,
			merged.assignedEditorTokenIdentifier
		);
	}

	return {
		searchBlob: buildBookingSearchBlob(merged, { assignedEditorDisplayName }),
		assignedEditorDisplayName
	};
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

export async function patchPackageSessionBookingsContactSearch(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	contactFields: PackageContactSearchFields
) {
	const bookings = await ctx.db
		.query("bookings")
		.withIndex("by_packageId_and_status_and_sessionStartAt", (indexQuery) =>
			indexQuery.eq("packageId", packageId)
		)
		.collect();

	await Promise.all(
		bookings.map(async (booking) => {
			const phone = normalizePhone(contactFields.phone);

			const searchBlobPatch = await searchBlobPatchForBooking(ctx, booking, {
				...contactFields,
				phone
			});

			return ctx.db.patch("bookings", booking._id, { ...contactFields, phone, ...searchBlobPatch });
		})
	);
}
