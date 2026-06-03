import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const editingAddons = ["Essential Edit", "Clips Package"] as const;

type LegacyDeliverableCountDoc = {
	addons: string[];
	deliverableCount?: string;
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
};

function hasAddon(addons: string[], addon: (typeof editingAddons)[number]) {
	return addons.includes(addon);
}

// Migrates legacy bookings from one shared editing deliverable quantity into
// per-add-on quantities. The old value is copied to each selected editing add-on
// because that shared count previously applied to every editing add-on on the booking.
export const migrateBookingEditingAddonQuantities = internalMutation({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const bookings = await ctx.db
			.query("bookings")
			.filter((q) => q.neq(q.field("deliverableCount"), undefined))
			.take(args.limit ?? 100);
		let migrated = 0;

		for (const booking of bookings) {
			const legacyBooking = booking as LegacyDeliverableCountDoc;
			const legacyQuantity = legacyBooking.deliverableCount;

			if (!legacyQuantity) {
				continue;
			}

			await ctx.db.patch(booking._id, {
				...(hasAddon(legacyBooking.addons, "Essential Edit")
					? { essentialEditQuantity: legacyQuantity }
					: {}),
				...(hasAddon(legacyBooking.addons, "Clips Package")
					? { clipsPackageQuantity: legacyQuantity }
					: {}),
				deliverableCount: undefined,
			} as Partial<LegacyDeliverableCountDoc>);
			migrated += 1;
		}

		return { checked: bookings.length, migrated };
	},
});

// Applies the same legacy quantity migration to custom invoices so regenerated
// or downloaded invoices keep the same editing add-on quantities after the schema change.
export const migrateCustomInvoiceEditingAddonQuantities = internalMutation({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const invoices = await ctx.db
			.query("customInvoices")
			.filter((q) => q.neq(q.field("deliverableCount"), undefined))
			.take(args.limit ?? 100);
		let migrated = 0;

		for (const invoice of invoices) {
			const legacyInvoice = invoice as LegacyDeliverableCountDoc;
			const legacyQuantity = legacyInvoice.deliverableCount;

			if (!legacyQuantity) {
				continue;
			}

			await ctx.db.patch(invoice._id, {
				...(hasAddon(legacyInvoice.addons, "Essential Edit")
					? { essentialEditQuantity: legacyQuantity }
					: {}),
				...(hasAddon(legacyInvoice.addons, "Clips Package")
					? { clipsPackageQuantity: legacyQuantity }
					: {}),
				deliverableCount: undefined,
			} as Partial<LegacyDeliverableCountDoc>);
			migrated += 1;
		}

		return { checked: invoices.length, migrated };
	},
});
