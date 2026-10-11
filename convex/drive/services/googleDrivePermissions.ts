"use node";

import type { AnyonePermission, DriveClient } from "#convex/drive/lib/googleDrive";
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
	return findAnyonePermission(drive, fileId, role).andThen((permission: AnyonePermission | null) =>
		useExistingOrCreateDrivePermission(permission, () =>
			createAnyonePermission(drive, fileId, role)
		)
	);
}

export function ensureAnyoneReaderPermission(drive: DriveClient, fileId: string) {
	return ensureAnyonePermission(drive, fileId, "reader").map(() => null);
}
