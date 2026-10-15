"use node";

import { google, type drive_v3 } from "googleapis";
import { err, ok, okAsync, type ResultAsync } from "neverthrow";
import { z } from "zod";
import { getGoogleOAuthClient } from "#convex/googleCalendar/lib/googleAuth";
import { logError } from "#convex/shared/lib/logger";
import { tryPromise } from "#convex/shared/lib/result";
import {
	driveErrorReason,
	driveFolderLookupReason,
	drivePermissionDeleteReason,
	googleProviderErrorSchema,
	googleShareErrorSchema,
	isMissingGoogleAccountShareMessage
} from "#convex/drive/lib/googleDriveErrors";

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
	emailAddress: z.string().email().optional(),
	role: z.union([z.literal("reader"), z.literal("writer"), z.literal("commenter")])
});

const listedDrivePermissionSchema = z.object({
	id: z.string().min(1),
	emailAddress: z.string().email().optional(),
	role: z.string().min(1),
	type: z.string().optional()
});

const anyonePermissionSchema = z.object({
	id: z.string().min(1),
	role: z.union([z.literal("reader"), z.literal("writer")]),
	type: z.literal("anyone")
});

export type DriveClient = drive_v3.Drive;

export type SavedDriveFolder = z.infer<typeof driveFolderSchema>;

export type SavedDrivePermission = z.infer<typeof drivePermissionSchema>;

export type AnyonePermission = z.infer<typeof anyonePermissionSchema>;

export type ListedDrivePermission = z.infer<typeof listedDrivePermissionSchema>;

export type DriveError = {
	reason:
		| "GOOGLE_DRIVE_AUTH_FAILED"
		| "GOOGLE_DRIVE_FOLDER_CREATE_FAILED"
		| "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID"
		| "GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED"
		| "GOOGLE_DRIVE_FOLDER_MISSING"
		| "GOOGLE_DRIVE_FOLDER_RENAME_FAILED"
		| "GOOGLE_DRIVE_FOLDER_DELETE_FAILED"
		| "GOOGLE_DRIVE_PERMISSION_CREATE_FAILED"
		| "GOOGLE_DRIVE_PERMISSION_DELETE_FAILED"
		| "GOOGLE_DRIVE_PERMISSION_LOOKUP_FAILED"
		| "GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID"
		| "GOOGLE_DRIVE_SHARE_TARGET_MISSING";
};

export function parseDriveFolderResponse(
	response: drive_v3.Schema$File | undefined
): import("neverthrow").Result<SavedDriveFolder, DriveError> {
	const folder = driveFolderSchema.safeParse(response);

	if (folder.success) return ok(folder.data);

	const failure = { reason: "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID" as const };
	logError(
		{
			operation: "googleDrive.folder.parseResponse",
			responseId: response?.id,
			reason: failure.reason
		},
		folder.error
	);

	return err(failure);
}

export function parseDriveFolderResponseIfAvailable(
	response: { data: drive_v3.Schema$File } | null
) {
	return response === null ? ok(null) : parseDriveFolderResponse(response.data);
}

export function parseDriveFolderValueIfAvailable(file: drive_v3.Schema$File | null) {
	return file === null ? ok(null) : parseDriveFolderResponse(file);
}

export function parseDriveFolderListResponse(
	files: drive_v3.Schema$File[] | undefined
): import("neverthrow").Result<SavedDriveFolder[], DriveError> {
	const folders = z.array(driveFolderSchema).safeParse(files ?? []);

	if (folders.success) return ok(folders.data);

	const failure = { reason: "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID" as const };
	logError(
		{
			operation: "googleDrive.folder.list.parseResponse",
			responseCount: files?.length,
			reason: failure.reason
		},
		folders.error
	);

	return err(failure);
}

export function parseDriveFolderListIfAvailable(
	response: { data: drive_v3.Schema$FileList } | null
) {
	if (response === null) return ok(null);

	return parseDriveFolderListResponse(response.data.files).map(firstDriveFolderOrNull);
}

export function parseDriveFolderChildrenResponse(
	files: drive_v3.Schema$File[] | undefined
): import("neverthrow").Result<ListedDriveChild[], DriveError> {
	const children = z.array(listedDriveChildSchema).safeParse(files ?? []);

	if (children.success) return ok(children.data);

	const failure = { reason: "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID" as const };
	logError(
		{
			operation: "googleDrive.folder.children.parseResponse",
			responseCount: files?.length,
			reason: failure.reason
		},
		children.error
	);

	return err(failure);
}

export function parseDrivePermissionListResponse(
	permissions: drive_v3.Schema$Permission[] | undefined
): import("neverthrow").Result<z.infer<typeof listedDrivePermissionSchema>[], DriveError> {
	const listed = z.array(listedDrivePermissionSchema).safeParse(permissions ?? []);

	if (listed.success) return ok(listed.data);

	const failure = { reason: "GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID" as const };
	logError(
		{
			operation: "googleDrive.permission.list.parseResponse",
			responseCount: permissions?.length,
			reason: failure.reason
		},
		listed.error
	);

	return err(failure);
}

export function parseDrivePermissionListForRemoval(
	response: DrivePermissionListResponse | null,
	input: { email: string; fileId: string | null; role: SavedDrivePermission["role"] }
) {
	if (response === null || input.fileId === null) {
		return ok(null);
	}

	return parseDrivePermissionListResponse(response.data.permissions).map((permissions) =>
		findDrivePermissionByEmailAndRole(permissions, { email: input.email, role: input.role })
	);
}

export function parseDrivePermissionResponse(
	response: drive_v3.Schema$Permission | undefined
): import("neverthrow").Result<SavedDrivePermission, DriveError> {
	const permission = drivePermissionSchema.safeParse(response);

	if (permission.success) return ok(permission.data);

	const failure = { reason: "GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID" as const };
	logError(
		{
			operation: "googleDrive.permission.parseResponse",
			responseId: response?.id,
			reason: failure.reason
		},
		permission.error
	);

	return err(failure);
}

export function parseAnyonePermissionResponse(
	response: drive_v3.Schema$Permission | undefined
): import("neverthrow").Result<AnyonePermission, DriveError> {
	const permission = anyonePermissionSchema.safeParse(response);

	if (permission.success) return ok(permission.data);

	const failure = { reason: "GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID" as const };
	logError(
		{
			operation: "googleDrive.anyonePermission.parseResponse",
			responseId: response?.id,
			reason: failure.reason
		},
		permission.error
	);

	return err(failure);
}

export function loadDriveClient() {
	return tryPromise({
		try: () =>
			Promise.resolve().then(() => google.drive({ version: "v3", auth: getGoogleOAuthClient() })),
		catch: (error) => {
			const failure = driveErrorReason(
				"GOOGLE_DRIVE_AUTH_FAILED",
				googleProviderErrorSchema.safeParse(error)
			);

			logError({ operation: "googleDrive.client.load", reason: failure.reason }, error);

			return failure;
		}
	});
}

export function createDriveFolderRequest(
	drive: DriveClient,
	input: { name: string; parentId: string; marker: string }
) {
	return tryPromise({
		try: () =>
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
		catch: (error) => {
			const failure = driveErrorReason(
				"GOOGLE_DRIVE_FOLDER_CREATE_FAILED",
				googleProviderErrorSchema.safeParse(error)
			);

			logError(
				{
					operation: "googleDrive.folder.create",
					parentFolderId: input.parentId,
					reason: failure.reason
				},
				error
			);

			return failure;
		}
	});
}

export function findDriveFolderByMarkerIfRequested(
	drive: DriveClient,
	input: { marker: string; parentId: string } | null
): ResultAsync<{ data: drive_v3.Schema$FileList } | null, DriveError> {
	if (input === null) return okAsync(null);

	const escapedMarker = input.marker.replaceAll("'", "\\'");
	const escapedParentId = input.parentId.replaceAll("'", "\\'");

	return tryPromise({
		try: () =>
			drive.files.list({
				fields: "files(id,name,webViewLink)",
				pageSize: 2,
				q: `'${escapedParentId}' in parents and trashed = false and appProperties has { key='vvWorkspaceMarker' and value='${escapedMarker}' }`
			}),
		catch: (error) => {
			const failure = driveErrorReason(
				"GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED",
				googleProviderErrorSchema.safeParse(error)
			);

			logError(
				{
					operation: "googleDrive.folder.lookupByMarker",
					parentFolderId: input.parentId,
					reason: failure.reason
				},
				error
			);

			return failure;
		}
	});
}

export const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

const listedDriveChildSchema = z.object({ id: z.string().min(1), mimeType: z.string().min(1) });

export type ListedDriveChild = z.infer<typeof listedDriveChildSchema>;

export function listDriveFolderChildrenRequest(drive: DriveClient, folderId: string) {
	const escapedFolderId = folderId.replaceAll("'", "\\'");

	return tryPromise({
		try: () =>
			drive.files.list({
				fields: "files(id,mimeType)",
				pageSize: 100,
				q: `'${escapedFolderId}' in parents and trashed = false`,
				supportsAllDrives: false
			}),
		catch: (error) => {
			const failure = driveFolderLookupReason(
				"GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED",
				googleProviderErrorSchema.safeParse(error)
			);

			if (failure.reason !== "GOOGLE_DRIVE_FOLDER_MISSING") {
				logError(
					{ operation: "googleDrive.folder.children.list", folderId, reason: failure.reason },
					error
				);
			}

			return failure;
		}
	});
}

export function deleteDriveItemRequest(drive: DriveClient, fileId: string) {
	return tryPromise({
		try: () => drive.files.delete({ fileId, supportsAllDrives: false }).then(() => null),
		catch: (error) => {
			const failure = driveFolderLookupReason(
				"GOOGLE_DRIVE_FOLDER_DELETE_FAILED",
				googleProviderErrorSchema.safeParse(error)
			);

			if (failure.reason !== "GOOGLE_DRIVE_FOLDER_MISSING") {
				logError(
					{ operation: "googleDrive.folder.delete", folderId: fileId, reason: failure.reason },
					error
				);
			}

			return failure;
		}
	});
}

export function verifyDriveFolderRequest(drive: DriveClient, folderId: string) {
	return tryPromise({
		try: () =>
			drive.files.get({
				fileId: folderId,
				fields: "id,name,webViewLink",
				supportsAllDrives: false
			}),
		catch: (error) => {
			const failure = driveFolderLookupReason(
				"GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED",
				googleProviderErrorSchema.safeParse(error)
			);

			if (failure.reason !== "GOOGLE_DRIVE_FOLDER_MISSING") {
				logError(
					{ operation: "googleDrive.folder.verify", folderId, reason: failure.reason },
					error
				);
			}

			return failure;
		}
	});
}

export function verifyDriveFolderIfPresent(
	drive: DriveClient,
	folderId: string | null
): ResultAsync<{ data: drive_v3.Schema$File } | null, DriveError> {
	if (folderId === null) return okAsync(null);

	return verifyDriveFolderRequest(drive, folderId);
}

export function renameDriveFolderRequest(
	drive: DriveClient,
	input: { folderId: string; name: string }
) {
	return tryPromise({
		try: () =>
			drive.files.update({
				fileId: input.folderId,
				fields: "id,name,webViewLink",
				requestBody: { name: input.name },
				supportsAllDrives: false
			}),
		catch: (error) => {
			const failure = driveFolderLookupReason(
				"GOOGLE_DRIVE_FOLDER_RENAME_FAILED",
				googleProviderErrorSchema.safeParse(error)
			);

			if (failure.reason !== "GOOGLE_DRIVE_FOLDER_MISSING") {
				logError(
					{
						operation: "googleDrive.folder.rename",
						folderId: input.folderId,
						reason: failure.reason
					},
					error
				);
			}

			return failure;
		}
	});
}

type DrivePermissionListResponse = { data: drive_v3.Schema$PermissionList };

export function findDrivePermissionRequest(
	drive: DriveClient | null,
	input: { email: string; fileId: string | null; role: SavedDrivePermission["role"] } | null
): ResultAsync<DrivePermissionListResponse | null, DriveError> {
	if (drive === null || input === null || input.fileId === null) {
		return okAsync(null);
	}

	const fileId = input.fileId;

	return tryPromise({
		try: () =>
			drive.permissions.list({
				fileId,
				fields: "permissions(id,emailAddress,role,type)",
				pageSize: 100,
				supportsAllDrives: false
			}),
		catch: (error) => {
			const failure = driveErrorReason(
				"GOOGLE_DRIVE_PERMISSION_LOOKUP_FAILED",
				googleProviderErrorSchema.safeParse(error)
			);

			logError(
				{ operation: "googleDrive.permission.lookup", fileId, reason: failure.reason },
				error
			);

			return failure;
		}
	});
}

export function createDrivePermissionRequest(
	drive: DriveClient,
	input: {
		email: string;
		fileId: string;
		role: SavedDrivePermission["role"];
		sendNotificationEmail: boolean;
	}
) {
	return tryPromise({
		try: () =>
			drive.permissions.create({
				fileId: input.fileId,
				fields: "id,emailAddress,role",
				sendNotificationEmail: input.sendNotificationEmail,
				requestBody: { emailAddress: input.email, role: input.role, type: "user" },
				supportsAllDrives: false
			}),
		catch: (error) => {
			if (error instanceof Error && isMissingGoogleAccountShareMessage(error.message)) {
				return { reason: "GOOGLE_DRIVE_SHARE_TARGET_MISSING" as const };
			}

			const failure = driveErrorReason(
				"GOOGLE_DRIVE_PERMISSION_CREATE_FAILED",
				googleProviderErrorSchema.safeParse(error),
				googleShareErrorSchema.safeParse(error)
			);

			if (failure.reason !== "GOOGLE_DRIVE_SHARE_TARGET_MISSING") {
				logError(
					{
						operation: "googleDrive.permission.create",
						fileId: input.fileId,
						reason: failure.reason
					},
					error
				);
			}

			return failure;
		}
	});
}

export function createDrivePermissionIfMissingRequest(
	drive: DriveClient,
	input: {
		email: string;
		fileId: string;
		role: SavedDrivePermission["role"];
		sendNotificationEmail: boolean;
	},
	existing: SavedDrivePermission | null
) {
	return existing === null
		? createDrivePermissionRequest(drive, input).map((response) => response.data)
		: okAsync(existing);
}

export function listDrivePermissionsRequest(drive: DriveClient, fileId: string) {
	return tryPromise({
		try: () =>
			drive.permissions.list({
				fileId,
				fields: "permissions(id,emailAddress,role,type)",
				pageSize: 100,
				supportsAllDrives: false
			}),
		catch: (error) => {
			const failure = driveErrorReason(
				"GOOGLE_DRIVE_PERMISSION_LOOKUP_FAILED",
				googleProviderErrorSchema.safeParse(error)
			);

			logError({ operation: "googleDrive.permission.list", fileId, reason: failure.reason }, error);

			return failure;
		}
	});
}

export function createDriveAnyonePermissionRequest(
	drive: DriveClient,
	fileId: string,
	role: "reader" | "writer"
) {
	return tryPromise({
		try: () =>
			drive.permissions.create({
				fileId,
				fields: "id,role,type",
				sendNotificationEmail: false,
				requestBody: { role, type: "anyone" },
				supportsAllDrives: false
			}),
		catch: (error) => {
			if (error instanceof Error && isMissingGoogleAccountShareMessage(error.message)) {
				return { reason: "GOOGLE_DRIVE_SHARE_TARGET_MISSING" as const };
			}

			const failure = driveErrorReason(
				"GOOGLE_DRIVE_PERMISSION_CREATE_FAILED",
				googleProviderErrorSchema.safeParse(error),
				googleShareErrorSchema.safeParse(error)
			);

			if (failure.reason !== "GOOGLE_DRIVE_SHARE_TARGET_MISSING") {
				logError(
					{ operation: "googleDrive.anyonePermission.create", fileId, reason: failure.reason },
					error
				);
			}

			return failure;
		}
	});
}

export function deleteDrivePermissionRequest(
	drive: DriveClient | null,
	input: { fileId: string; permissionId: string } | null
) {
	if (drive === null || input === null) {
		return okAsync(null);
	}

	return tryPromise({
		try: () =>
			drive.permissions
				.delete({
					fileId: input.fileId,
					permissionId: input.permissionId,
					supportsAllDrives: false
				})
				.then(() => null),
		catch: (error) => {
			const failure = drivePermissionDeleteReason(
				googleProviderErrorSchema.safeParse(error),
				googleShareErrorSchema.safeParse(error)
			);

			if (failure.permissionIsMissing) return failure;

			if (failure.reason !== "GOOGLE_DRIVE_SHARE_TARGET_MISSING") {
				logError(
					{
						operation: "googleDrive.permission.delete",
						fileId: input.fileId,
						reason: failure.reason
					},
					error
				);
			}

			return failure;
		}
	});
}

export function normalizeDriveEmail(email: string) {
	return email.trim().toLowerCase();
}

export function firstDriveFolderOrNull(folders: SavedDriveFolder[]) {
	return folders.at(0) ?? null;
}

export function findDrivePermissionByEmailAndRole(
	permissions: ListedDrivePermission[],
	input: { email: string; role: SavedDrivePermission["role"] }
) {
	const permission = permissions.find(
		(candidate) =>
			candidate.emailAddress?.toLowerCase() === input.email.toLowerCase() &&
			candidate.role === input.role
	);

	if (permission === undefined || permission.emailAddress === undefined) return null;

	return { id: permission.id, emailAddress: permission.emailAddress, role: input.role };
}

export function findAnyoneDrivePermission(
	permissions: ListedDrivePermission[],
	role: "reader" | "writer"
): AnyonePermission | null {
	const permission = permissions.find(
		(candidate) => candidate.type === "anyone" && candidate.role === role
	);

	return permission === undefined ? null : { id: permission.id, role, type: "anyone" };
}

export function ignoreMissingDriveFolder(error: DriveError) {
	return error.reason === "GOOGLE_DRIVE_FOLDER_MISSING" ? ok(null) : err(error);
}

export function ignoreMissingDrivePermission(error: {
	permissionIsMissing: boolean;
	reason: DriveError["reason"];
}) {
	return error.permissionIsMissing ? ok(null) : err({ reason: error.reason });
}

export function useExistingOrCreateDrivePermission(
	permission: AnyonePermission | null,
	create: () => ResultAsync<AnyonePermission, DriveError>
): ResultAsync<AnyonePermission, DriveError> {
	return permission === null ? create() : okAsync(permission);
}
