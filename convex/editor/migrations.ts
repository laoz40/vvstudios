import { Migrations, vMigrationArgs } from "@convex-dev/migrations";
import type { RegisteredMutation } from "convex/server";
import type { Infer } from "convex/values";
import { components } from "#convex/_generated/api";
import { createLegacyEditsForSession } from "#convex/editor/services/legacyEdits";
import schema from "#convex/schema";

const migrations = new Migrations(components.migrations, { schema });

export const createLegacyEdits: RegisteredMutation<
	"internal",
	Infer<typeof vMigrationArgs>,
	Promise<unknown>
> = migrations.define({
	table: "bookings",
	batchSize: 25,
	customRange: (query) =>
		query.withIndex("by_assignedEditorTokenIdentifier_and_driveClientId", (index) =>
			index.gt("assignedEditorTokenIdentifier", undefined)
		),
	migrateOne: createLegacyEditsForSession
});
