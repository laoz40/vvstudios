"use node";

import { ok, safeTry } from "neverthrow";

import type { DriveClient } from "#convex/drive/lib/googleDrive";
import {
	createAnyonePermission,
	findAnyonePermission
} from "#convex/drive/services/googleDriveOperations";
import { useExistingOrCreateDrivePermission } from "#convex/drive/lib/googleDrive";

export function ensureAnyonePermission(
	drive: DriveClient,
	fileId: string,
	role: "reader" | "writer"
) {
	return safeTry(async function* () {
		const permission = yield* findAnyonePermission(drive, fileId, role);

		const resolvedPermission = yield* useExistingOrCreateDrivePermission(permission, () =>
			createAnyonePermission(drive, fileId, role)
		);

		return ok(resolvedPermission);
	});
}

export function ensureAnyoneReaderPermission(drive: DriveClient, fileId: string) {
	return safeTry(async function* () {
		yield* ensureAnyonePermission(drive, fileId, "reader");

		return ok(null);
	});
}
