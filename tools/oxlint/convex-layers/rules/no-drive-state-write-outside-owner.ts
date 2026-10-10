import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";
import {
	getDirectDbWrite,
	isConvexTestFile,
	normalizedConvexFilename
} from "../shared/direct-db-writes.ts";

const DRIVE_TABLES = new Set([
	"driveClients",
	"driveSessions",
	"driveClientEditorPermissions"
]);
const DRIVE_TABLE_WRITERS = new Map([
	["convex/drive/lib/driveFolders.ts", new Set(["driveClients", "driveSessions"])],
	["convex/drive/lib/driveClientAccess.ts", new Set(["driveClients", "driveSessions"])],
	["convex/drive/lib/driveEditor.ts", new Set(["driveSessions", "driveClientEditorPermissions"])],
	["convex/drive/lib/sessionFolders/allocateNumbers.ts", new Set(["driveSessions"])],
	["convex/drive/lib/sessionFolders/clearSessionRecords.ts", new Set(["driveSessions"])]
]);
const BOOKING_INSERT_WRITER = "convex/sessions/lib/pendingCheckoutSession.ts";
const BOOKING_LINK_WRITER = "convex/drive/lib/driveBookingDriveClient.ts";
const BOOKING_FAILURE_WRITER = "convex/drive/lib/driveFolders.ts";
const BOOKING_DRIVE_FIELDS = new Set([
	"driveClientId",
	"driveSetupFailedAt",
	"driveSetupFailureCode"
]);

/** Checks direct ctx.db writes with statically visible table and field names. */
export const noDriveStateWriteOutsideOwnerRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description: "Restrict Drive recovery state writes to their owning Convex lib primitives."
		},
		messages: {
			driveTableWrite:
				"Drive table writes belong in convex/drive/lib/driveFolders, driveClientAccess, driveEditor, or sessionFolders/allocateNumbers and clearSessionRecords.",
			bookingDriveClientId:
				"Update booking Drive linkage through patchBookingDriveClientId in convex/drive/lib/driveBookingDriveClient.ts.",
			bookingDriveFailure:
				"Update booking Drive failure state through saveDriveSetupResult in convex/drive/lib/driveFolders.ts."
		}
	},
	create(context) {
		const filename = normalizedConvexFilename(context.filename);
		if (isConvexTestFile(context.filename)) return {};

		return {
			CallExpression(node: ESTree.CallExpression) {
				const write = getDirectDbWrite(node);
				if (!write || write.table === undefined) return;

				if (DRIVE_TABLES.has(write.table)) {
					if (!DRIVE_TABLE_WRITERS.get(filename)?.has(write.table)) {
						context.report({ node, messageId: "driveTableWrite" });
					}
					return;
				}
				if (write.table !== "bookings") return;

				for (const field of write.fields) {
					if (!BOOKING_DRIVE_FIELDS.has(field)) continue;
					if (field === "driveClientId") {
						const supportedUpdate = filename === BOOKING_LINK_WRITER;
						const supportedInsert = write.method === "insert" && filename === BOOKING_INSERT_WRITER;
						if (!supportedUpdate && !supportedInsert) {
							context.report({ node, messageId: "bookingDriveClientId" });
							return;
						}
						continue;
					}
					if (filename !== BOOKING_FAILURE_WRITER) {
						context.report({ node, messageId: "bookingDriveFailure" });
						return;
					}
				}
			}
		};
	}
});
