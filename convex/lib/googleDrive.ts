"use node";

import { google, type drive_v3 } from "googleapis";
import { ResultAsync, err, ok } from "neverthrow";
import { z } from "zod";
import { getGoogleOAuthClient } from "#convex/lib/googleAuth";

export {
	formatDriveClientFolderName as getClientFolderName,
	formatDrivePackageFolderName as getPackageFolderName,
	formatDrivePackageSessionFolderName as getPackageSessionFolderName,
	formatDriveSessionFolderName as getSessionFolderName,
	formatDriveSessionMediaFolderName as getSessionMediaFolderName
} from "#studio/lib/bookingdatetime";

export const GOOGLE_DRIVE_CHILD_FOLDER_NAMES = ["Raw Media", "Deliverables"] as const;
export type DriveChildFolderName = (typeof GOOGLE_DRIVE_CHILD_FOLDER_NAMES)[number];

const driveFolderSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	webViewLink: z.url()
});
const drivePermissionSchema = z.object({
	id: z.string().min(1),
	emailAddress: z.string().email(),
	role: z.union([z.literal("reader"), z.literal("writer"), z.literal("commenter")])
});
const listedDrivePermissionSchema = z.object({
	id: z.string().min(1),
	emailAddress: z.string().email().optional(),
	role: z.string().min(1)
});
const googleProviderErrorSchema = z.object({ code: z.number() });

export type DriveClient = drive_v3.Drive;
export type SavedDriveFolder = z.infer<typeof driveFolderSchema>;
export type SavedDrivePermission = z.infer<typeof drivePermissionSchema>;
export type DriveError = {
	reason:
		| "GOOGLE_DRIVE_AUTH_FAILED"
		| "GOOGLE_DRIVE_FOLDER_CREATE_FAILED"
		| "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID"
		| "GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED"
		| "GOOGLE_DRIVE_FOLDER_MISSING"
		| "GOOGLE_DRIVE_FOLDER_RENAME_FAILED"
		| "GOOGLE_DRIVE_PERMISSION_CREATE_FAILED"
		| "GOOGLE_DRIVE_PERMISSION_DELETE_FAILED"
		| "GOOGLE_DRIVE_PERMISSION_LOOKUP_FAILED"
		| "GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID";
};

function getGoogleProviderErrorCode(error: unknown) {
	const parsedError = googleProviderErrorSchema.safeParse(error);
	return parsedError.success ? parsedError.data.code : null;
}

function mapDriveError(error: unknown, fallback: DriveError["reason"]) {
	const code = getGoogleProviderErrorCode(error);
	if (code === 401 || code === 403) return { reason: "GOOGLE_DRIVE_AUTH_FAILED" as const };
	return { reason: fallback };
}

export function loadDriveClient() {
	return ResultAsync.fromPromise(
		Promise.resolve().then(() => google.drive({ version: "v3", auth: getGoogleOAuthClient() })),
		(error) => mapDriveError(error, "GOOGLE_DRIVE_AUTH_FAILED")
	);
}

export function createDriveFolder(
	drive: DriveClient,
	input: { name: string; parentId: string; marker: string }
) {
	return ResultAsync.fromPromise(
		drive.files.create({
			fields: "id,name,webViewLink",
			requestBody: {
				name: input.name,
				mimeType: "application/vnd.google-apps.folder",
				parents: [input.parentId],
				writersCanShare: false,
				// Private metadata identifies this booking folder if a create response is lost.
				appProperties: { vvWorkspaceMarker: input.marker }
			}
		}),
		(error) => mapDriveError(error, "GOOGLE_DRIVE_FOLDER_CREATE_FAILED")
	).andThen((response) => {
		const parsedFolder = driveFolderSchema.safeParse(response.data);
		return parsedFolder.success
			? ok(parsedFolder.data)
			: err({ reason: "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID" as const });
	});
}

export function findDriveFolderByMarker(
	drive: DriveClient,
	input: { marker: string; parentId: string }
) {
	const escapedMarker = input.marker.replaceAll("'", "\\'");
	const escapedParentId = input.parentId.replaceAll("'", "\\'");
	return ResultAsync.fromPromise(
		drive.files.list({
			fields: "files(id,name,webViewLink)",
			pageSize: 2,
			q: `'${escapedParentId}' in parents and trashed = false and appProperties has { key='vvWorkspaceMarker' and value='${escapedMarker}' }`
		}),
		(error) => mapDriveError(error, "GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED")
	).andThen((response) => {
		const folders = z.array(driveFolderSchema).safeParse(response.data.files ?? []);
		if (!folders.success) return err({ reason: "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID" as const });
		return ok(folders.data.at(0) ?? null);
	});
}

const listedDriveChildSchema = z.object({ id: z.string().min(1) });

export function listDriveFolderChildren(drive: DriveClient, folderId: string) {
	const escapedFolderId = folderId.replaceAll("'", "\\'");
	return ResultAsync.fromPromise(
		drive.files.list({
			fields: "files(id)",
			pageSize: 1,
			q: `'${escapedFolderId}' in parents and trashed = false`,
			supportsAllDrives: false
		}),
		(error) => {
			if (getGoogleProviderErrorCode(error) === 404) {
				return { reason: "GOOGLE_DRIVE_FOLDER_MISSING" as const };
			}
			return mapDriveError(error, "GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED");
		}
	).andThen((response) => {
		const children = z.array(listedDriveChildSchema).safeParse(response.data.files ?? []);
		if (!children.success) return err({ reason: "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID" as const });
		return ok(children.data);
	});
}

export function verifyDriveFolder(drive: DriveClient, folderId: string) {
	return ResultAsync.fromPromise(
		drive.files.get({ fileId: folderId, fields: "id,name,webViewLink", supportsAllDrives: false }),
		(error) => {
			if (getGoogleProviderErrorCode(error) === 404) {
				return { reason: "GOOGLE_DRIVE_FOLDER_MISSING" as const };
			}
			return mapDriveError(error, "GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED");
		}
	).andThen((response) => {
		const folder = driveFolderSchema.safeParse(response.data);
		return folder.success
			? ok(folder.data)
			: err({ reason: "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID" as const });
	});
}

export function renameDriveFolder(drive: DriveClient, input: { folderId: string; name: string }) {
	return ResultAsync.fromPromise(
		drive.files.update({
			fileId: input.folderId,
			fields: "id,name,webViewLink",
			requestBody: { name: input.name },
			supportsAllDrives: false
		}),
		(error) => {
			if (getGoogleProviderErrorCode(error) === 404) {
				return { reason: "GOOGLE_DRIVE_FOLDER_MISSING" as const };
			}
			return mapDriveError(error, "GOOGLE_DRIVE_FOLDER_RENAME_FAILED");
		}
	).andThen((response) => {
		const folder = driveFolderSchema.safeParse(response.data);
		return folder.success
			? ok(folder.data)
			: err({ reason: "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID" as const });
	});
}

export function findDrivePermission(
	drive: DriveClient,
	input: { email: string; fileId: string; role: SavedDrivePermission["role"] }
) {
	return ResultAsync.fromPromise(
		drive.permissions.list({
			fileId: input.fileId,
			fields: "permissions(id,emailAddress,role)",
			pageSize: 100,
			supportsAllDrives: false
		}),
		(error) => mapDriveError(error, "GOOGLE_DRIVE_PERMISSION_LOOKUP_FAILED")
	).andThen((response) => {
		// The list also contains owner, domain, and public permissions. Only the matching
		// client permission needs the narrower role and email shape used by this workflow.
		const permissions = z
			.array(listedDrivePermissionSchema)
			.safeParse(response.data.permissions ?? []);
		if (!permissions.success) {
			return err({ reason: "GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID" as const });
		}
		const permission = permissions.data.find(
			(candidate) =>
				candidate.emailAddress?.toLowerCase() === input.email.toLowerCase() &&
				candidate.role === input.role
		);
		if (permission === undefined || permission.emailAddress === undefined) return ok(null);
		return ok({ id: permission.id, emailAddress: permission.emailAddress, role: input.role });
	});
}

export function createDrivePermission(
	drive: DriveClient,
	input: {
		email: string;
		fileId: string;
		role: SavedDrivePermission["role"];
		sendNotificationEmail: boolean;
	}
) {
	return ResultAsync.fromPromise(
		drive.permissions.create({
			fileId: input.fileId,
			fields: "id,emailAddress,role",
			sendNotificationEmail: input.sendNotificationEmail,
			requestBody: { emailAddress: input.email, role: input.role, type: "user" },
			supportsAllDrives: false
		}),
		(error) => mapDriveError(error, "GOOGLE_DRIVE_PERMISSION_CREATE_FAILED")
	).andThen((response) => {
		const permission = drivePermissionSchema.safeParse(response.data);
		return permission.success
			? ok(permission.data)
			: err({ reason: "GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID" as const });
	});
}

export function deleteDrivePermission(
	drive: DriveClient,
	input: { fileId: string; permissionId: string }
) {
	return ResultAsync.fromPromise(
		drive.permissions
			.delete({ fileId: input.fileId, permissionId: input.permissionId, supportsAllDrives: false })
			.then(() => null),
		(error) => ({
			permissionIsMissing: getGoogleProviderErrorCode(error) === 404,
			reason: mapDriveError(error, "GOOGLE_DRIVE_PERMISSION_DELETE_FAILED").reason
		})
	).orElse((error) => {
		// A prior partial attempt may already have removed this permission.
		if (error.permissionIsMissing) return ok(null);
		return err({ reason: error.reason });
	});
}

export function normalizeDriveEmail(email: string) {
	return email.trim().toLowerCase();
}
