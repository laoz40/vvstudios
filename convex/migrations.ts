import { internalMutation, query, type MutationCtx } from "#convex/_generated/server";
import {
	hasLegacyClipsPackageAddon,
	renameClipsPackageInAddons
} from "#convex/lib/renameClipsPackageAddon";

const ADDON_TABLES = ["bookings", "multiBookingPackages", "customInvoices"] as const;
type AddonTableName = (typeof ADDON_TABLES)[number];

async function backfillAddonTable(ctx: MutationCtx, table: AddonTableName) {
	const documents = await ctx.db.query(table).collect();
	let updatedCount = 0;

	for (const document of documents) {
		const result = renameClipsPackageInAddons(document.addons);

		if (!result.changed) {
			continue;
		}

		await ctx.db.patch(document._id, { addons: result.addons });
		updatedCount += 1;
	}

	return updatedCount;
}

export const backfillClipVolumePackAddonName = internalMutation({
	args: {},
	handler: async (ctx) => {
		const updatedByTable: Record<AddonTableName, number> = {
			bookings: 0,
			customInvoices: 0,
			multiBookingPackages: 0
		};

		for (const table of ADDON_TABLES) {
			updatedByTable[table] = await backfillAddonTable(ctx, table);
		}

		return {
			updatedByTable,
			totalUpdated:
				updatedByTable.bookings +
				updatedByTable.multiBookingPackages +
				updatedByTable.customInvoices
		};
	}
});

export const verifyClipVolumePackAddonBackfill = query({
	args: {},
	handler: async (ctx) => {
		const remainingByTable: Record<AddonTableName, number> = {
			bookings: 0,
			customInvoices: 0,
			multiBookingPackages: 0
		};

		for (const table of ADDON_TABLES) {
			const documents = await ctx.db.query(table).collect();

			remainingByTable[table] = documents.filter((document) =>
				hasLegacyClipsPackageAddon(document.addons)
			).length;
		}

		const totalRemaining =
			remainingByTable.bookings +
			remainingByTable.multiBookingPackages +
			remainingByTable.customInvoices;

		return { complete: totalRemaining === 0, remainingByTable, totalRemaining };
	}
});
