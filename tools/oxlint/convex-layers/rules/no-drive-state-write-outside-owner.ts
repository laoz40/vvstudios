import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

const DRIVE_TABLES = new Set([
	"driveClients",
	"driveSessions",
	"driveClientEditorPermissions"
]);
const DRIVE_TABLE_WRITERS = new Map([
	["convex/lib/drive/driveFolders.ts", new Set(["driveClients", "driveSessions"])],
	["convex/lib/drive/driveClientAccess.ts", new Set(["driveClients", "driveSessions"])],
	["convex/lib/drive/driveEditor.ts", new Set(["driveSessions", "driveClientEditorPermissions"])],
	["convex/lib/drive/sessionFolders/allocateNumbers.ts", new Set(["driveSessions"])],
	["convex/lib/drive/sessionFolders/clearSessionRecords.ts", new Set(["driveSessions"])]
]);
const BOOKING_INSERT_WRITER = "convex/lib/sessions/pendingCheckoutSession.ts";
const BOOKING_LINK_WRITER = "convex/lib/drive/driveBookingDriveClient.ts";
const BOOKING_FAILURE_WRITER = "convex/lib/drive/driveFolders.ts";
const BOOKING_DRIVE_FIELDS = new Set([
	"driveClientId",
	"driveSetupFailedAt",
	"driveSetupFailureCode"
]);

function normalizedFilename(filename: string): string {
	const normalized = filename.replaceAll("\\", "/");
	const convexIndex = normalized.lastIndexOf("/convex/");
	return convexIndex === -1 ? normalized : normalized.slice(convexIndex + 1);
}

function isTestFile(filename: string): boolean {
	return /(?:\/tests\/|\.test\.[cm]?tsx?$)/u.test(filename.replaceAll("\\", "/"));
}

function literalString(node: ESTree.Node | undefined): string | undefined {
	if (node?.type === "Literal" && typeof node.value === "string") return node.value;
	if (node?.type === "TemplateLiteral" && node.expressions.length === 0) {
		return node.quasis[0]?.value.cooked ?? undefined;
	}
	return undefined;
}

function memberProperty(node: ESTree.MemberExpression): string | undefined {
	return node.computed
		? literalString(node.property)
		: node.property.type === "Identifier" ? node.property.name : undefined;
}

function isCtxDb(node: ESTree.Node): boolean {
	return (
		node.type === "MemberExpression" &&
		node.object.type === "Identifier" &&
		node.object.name === "ctx" &&
		memberProperty(node) === "db"
	);
}

function objectPropertyName(node: ESTree.ObjectProperty): string | undefined {
	if (!node.computed && node.key.type === "Identifier") return node.key.name;
	return literalString(node.key);
}

function bookingDriveFields(node: ESTree.Node | undefined): Set<string> {
	const fields = new Set<string>();
	if (node?.type !== "ObjectExpression") return fields;
	for (const property of node.properties) {
		if (property.type === "SpreadElement") {
			for (const field of bookingDriveFields(property.argument)) fields.add(field);
		} else if (property.type === "Property") {
			const name = objectPropertyName(property);
			if (name !== undefined && BOOKING_DRIVE_FIELDS.has(name)) fields.add(name);
		}
	}
	return fields;
}

function bookingWriteFields(node: ESTree.CallExpression, method: string): ESTree.Node | undefined {
	if (method === "insert") return node.arguments[1];
	if (method === "patch" || method === "replace") return node.arguments[2];
	return undefined;
}

/** Checks direct ctx.db writes with statically visible table and field names. */
export const noDriveStateWriteOutsideOwnerRule = defineRule({
	meta: {
		type: "problem",
		docs: {
			description: "Restrict Drive recovery state writes to their owning Convex lib primitives."
		},
		messages: {
			driveTableWrite:
				"Drive table writes belong in convex/lib/drive/driveFolders, driveClientAccess, driveEditor, or sessionFolders/allocateNumbers and clearSessionRecords.",
			bookingDriveClientId:
				"Update booking Drive linkage through patchBookingDriveClientId in convex/lib/drive/driveBookingDriveClient.ts.",
			bookingDriveFailure:
				"Update booking Drive failure state through saveDriveSetupResult in convex/lib/drive/driveFolders.ts."
		}
	},
	create(context) {
		const filename = normalizedFilename(context.filename);
		if (isTestFile(context.filename)) return {};

		return {
			CallExpression(node: ESTree.CallExpression) {
				if (node.callee.type !== "MemberExpression" || !isCtxDb(node.callee.object)) return;
				const method = memberProperty(node.callee);
				if (method !== "insert" && method !== "patch" && method !== "replace" && method !== "delete") {
					return;
				}
			const table = literalString(node.arguments[0]);

				if (table !== undefined && DRIVE_TABLES.has(table)) {
					if (!DRIVE_TABLE_WRITERS.get(filename)?.has(table)) {
						context.report({ node, messageId: "driveTableWrite" });
					}
					return;
				}
				if (table !== "bookings") return;

				for (const field of bookingDriveFields(bookingWriteFields(node, method))) {
					if (field === "driveClientId") {
						const supportedUpdate = filename === BOOKING_LINK_WRITER;
						const supportedInsert = method === "insert" && filename === BOOKING_INSERT_WRITER;
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
