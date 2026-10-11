"use node";

import { google, type drive_v3 } from "googleapis";
import { err, ok, okAsync, type ResultAsync } from "neverthrow";
import { z } from "zod";
import { getGoogleOAuthClient } from "#convex/googleCalendar/lib/googleAuth";
import { tryPromise } from "#convex/shared/lib/result";

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

const googleProviderErrorSchema = z.object({
	status: z.number().optional(),
	response: z.object({ status: z.number().optional() }).optional()
});

const googleShareErrorSchema = z.object({
	errors: z.array(z.object({ reason: z.string(), message: z.string().optional() })).optional(),
	response: z
		.object({
			data: z
				.object({
					error: z
						.object({
							errors: z
								.array(z.object({ reason: z.string(), message: z.string().optional() }))
								.optional(),
							message: z.string().optional()
						})
						.optional()
				})
				.optional()
		})
		.optional()
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

	return folder.success ? ok(folder.data) : err({ reason: "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID" });
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

	return folders.success
		? ok(folders.data)
		: err({ reason: "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID" });
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

	return children.success
		? ok(children.data)
		: err({ reason: "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID" });
}

export function parseDrivePermissionListResponse(
	permissions: drive_v3.Schema$Permission[] | undefined
): import("neverthrow").Result<z.infer<typeof listedDrivePermissionSchema>[], DriveError> {
	const listed = z.array(listedDrivePermissionSchema).safeParse(permissions ?? []);

	return listed.success
		? ok(listed.data)
		: err({ reason: "GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID" });
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

	return permission.success
		? ok(permission.data)
		: err({ reason: "GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID" });
}

export function parseAnyonePermissionResponse(
	response: drive_v3.Schema$Permission | undefined
): import("neverthrow").Result<AnyonePermission, DriveError> {
	const permission = anyonePermissionSchema.safeParse(response);

	return permission.success
		? ok(permission.data)
		: err({ reason: "GOOGLE_DRIVE_PERMISSION_RESPONSE_INVALID" });
}

type ParsedGoogleProviderError = z.infer<typeof googleProviderErrorSchema>;

type ParsedGoogleShareError = z.infer<typeof googleShareErrorSchema>;

function providerStatus(error: ParsedGoogleProviderError) {
	return error.status ?? error.response?.status ?? null;
}

function isMissingGoogleAccountShare(error: ParsedGoogleShareError) {
	const shareErrors = [...(error.errors ?? []), ...(error.response?.data?.error?.errors ?? [])];

	if (shareErrors.some((shareError) => shareError.reason === "invalidSharingRequest")) {
		return true;
	}

	const messages = [
		error.response?.data?.error?.message,
		...shareErrors.map((shareError) => shareError.message)
	].filter((message): message is string => message !== undefined);

	return messages.some((message) => isMissingGoogleAccountShareMessage(message));
}

function isMissingGoogleAccountShareMessage(message: string) {
	return /does not have a Google Account|not connected to a Google account|no Google account associated/i.test(
		message
	);
}

function driveErrorReason(
	fallback: DriveError["reason"],
	parsedProviderError: ReturnType<typeof googleProviderErrorSchema.safeParse>,
	parsedShareError?: ReturnType<typeof googleShareErrorSchema.safeParse>
) {
	const code = parsedProviderError.success ? providerStatus(parsedProviderError.data) : null;

	if (code === 401 || code === 403) {
		return { reason: "GOOGLE_DRIVE_AUTH_FAILED" as const };
	}

	if (
		fallback === "GOOGLE_DRIVE_PERMISSION_CREATE_FAILED" &&
		parsedShareError?.success &&
		isMissingGoogleAccountShare(parsedShareError.data)
	) {
		return { reason: "GOOGLE_DRIVE_SHARE_TARGET_MISSING" as const };
	}

	return { reason: fallback };
}

function driveFolderLookupReason(
	fallback: DriveError["reason"],
	parsedProviderError: ReturnType<typeof googleProviderErrorSchema.safeParse>
) {
	const code = parsedProviderError.success ? providerStatus(parsedProviderError.data) : null;

	if (code === 404) {
		return { reason: "GOOGLE_DRIVE_FOLDER_MISSING" as const };
	}

	return driveErrorReason(fallback, parsedProviderError);
}

function drivePermissionDeleteReason(
	parsedProviderError: ReturnType<typeof googleProviderErrorSchema.safeParse>,
	parsedShareError: ReturnType<typeof googleShareErrorSchema.safeParse>
) {
	const code = parsedProviderError.success ? providerStatus(parsedProviderError.data) : null;

	return {
		permissionIsMissing: code === 404,
		reason: driveErrorReason(
			"GOOGLE_DRIVE_PERMISSION_DELETE_FAILED",
			parsedProviderError,
			parsedShareError
		).reason
	};
}

function driveResultAsync<T>(promise: Promise<T>, fallback: DriveError["reason"]) {
	return tryPromise({
		try: () => promise,
		catch: (error) => {
			if (
				fallback === "GOOGLE_DRIVE_PERMISSION_CREATE_FAILED" &&
				error instanceof Error &&
				isMissingGoogleAccountShareMessage(error.message)
			) {
				return { reason: "GOOGLE_DRIVE_SHARE_TARGET_MISSING" as const };
			}

			return driveErrorReason(
				fallback,
				googleProviderErrorSchema.safeParse(error),
				fallback === "GOOGLE_DRIVE_PERMISSION_CREATE_FAILED"
					? googleShareErrorSchema.safeParse(error)
					: undefined
			);
		}
	});
}

function driveFolderLookupAsync<T>(promise: Promise<T>, fallback: DriveError["reason"]) {
	return tryPromise({
		try: () => promise,
		catch: (error) => driveFolderLookupReason(fallback, googleProviderErrorSchema.safeParse(error))
	});
}

function drivePermissionDeleteAsync<T>(promise: Promise<T>) {
	return tryPromise({
		try: () => promise,
		catch: (error) =>
			drivePermissionDeleteReason(
				googleProviderErrorSchema.safeParse(error),
				googleShareErrorSchema.safeParse(error)
			)
	});
}

export function loadDriveClient() {
	return driveResultAsync(
		Promise.resolve().then(() => google.drive({ version: "v3", auth: getGoogleOAuthClient() })),
		"GOOGLE_DRIVE_AUTH_FAILED"
	);
}

export function createDriveFolderRequest(
	drive: DriveClient,
	input: { name: string; parentId: string; marker: string }
) {
	return driveResultAsync(
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
		"GOOGLE_DRIVE_FOLDER_CREATE_FAILED"
	);
}

export function findDriveFolderByMarkerIfRequested(
	drive: DriveClient,
	input: { marker: string; parentId: string } | null
): ResultAsync<{ data: drive_v3.Schema$FileList } | null, DriveError> {
	if (input === null) return okAsync(null);

	const escapedMarker = input.marker.replaceAll("'", "\\'");
	const escapedParentId = input.parentId.replaceAll("'", "\\'");

	return driveResultAsync(
		drive.files.list({
			fields: "files(id,name,webViewLink)",
			pageSize: 2,
			q: `'${escapedParentId}' in parents and trashed = false and appProperties has { key='vvWorkspaceMarker' and value='${escapedMarker}' }`
		}),
		"GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED"
	);
}

export const GOOGLE_DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

const listedDriveChildSchema = z.object({ id: z.string().min(1), mimeType: z.string().min(1) });

export type ListedDriveChild = z.infer<typeof listedDriveChildSchema>;

export function listDriveFolderChildrenRequest(drive: DriveClient, folderId: string) {
	const escapedFolderId = folderId.replaceAll("'", "\\'");

	return driveFolderLookupAsync(
		drive.files.list({
			fields: "files(id,mimeType)",
			pageSize: 100,
			q: `'${escapedFolderId}' in parents and trashed = false`,
			supportsAllDrives: false
		}),
		"GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED"
	);
}

export function deleteDriveItemRequest(drive: DriveClient, fileId: string) {
	return driveFolderLookupAsync(
		drive.files.delete({ fileId, supportsAllDrives: false }).then(() => null),
		"GOOGLE_DRIVE_FOLDER_DELETE_FAILED"
	);
}

export function verifyDriveFolderRequest(drive: DriveClient, folderId: string) {
	return driveFolderLookupAsync(
		drive.files.get({ fileId: folderId, fields: "id,name,webViewLink", supportsAllDrives: false }),
		"GOOGLE_DRIVE_FOLDER_LOOKUP_FAILED"
	);
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
	return driveFolderLookupAsync(
		drive.files.update({
			fileId: input.folderId,
			fields: "id,name,webViewLink",
			requestBody: { name: input.name },
			supportsAllDrives: false
		}),
		"GOOGLE_DRIVE_FOLDER_RENAME_FAILED"
	);
}

type DrivePermissionListResponse = { data: drive_v3.Schema$PermissionList };

export function findDrivePermissionRequest(
	drive: DriveClient | null,
	input: { email: string; fileId: string | null; role: SavedDrivePermission["role"] } | null
): ResultAsync<DrivePermissionListResponse | null, DriveError> {
	if (drive === null || input === null || input.fileId === null) {
		return okAsync(null);
	}

	return driveResultAsync(
		drive.permissions.list({
			fileId: input.fileId,
			fields: "permissions(id,emailAddress,role,type)",
			pageSize: 100,
			supportsAllDrives: false
		}),
		"GOOGLE_DRIVE_PERMISSION_LOOKUP_FAILED"
	);
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
	return driveResultAsync(
		drive.permissions.create({
			fileId: input.fileId,
			fields: "id,emailAddress,role",
			sendNotificationEmail: input.sendNotificationEmail,
			requestBody: { emailAddress: input.email, role: input.role, type: "user" },
			supportsAllDrives: false
		}),
		"GOOGLE_DRIVE_PERMISSION_CREATE_FAILED"
	);
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
	return driveResultAsync(
		drive.permissions.list({
			fileId,
			fields: "permissions(id,emailAddress,role,type)",
			pageSize: 100,
			supportsAllDrives: false
		}),
		"GOOGLE_DRIVE_PERMISSION_LOOKUP_FAILED"
	);
}

export function createDriveAnyonePermissionRequest(
	drive: DriveClient,
	fileId: string,
	role: "reader" | "writer"
) {
	return driveResultAsync(
		drive.permissions.create({
			fileId,
			fields: "id,role,type",
			sendNotificationEmail: false,
			requestBody: { role, type: "anyone" },
			supportsAllDrives: false
		}),
		"GOOGLE_DRIVE_PERMISSION_CREATE_FAILED"
	);
}

export function deleteDrivePermissionRequest(
	drive: DriveClient | null,
	input: { fileId: string; permissionId: string } | null
) {
	if (drive === null || input === null) {
		return okAsync(null);
	}

	return drivePermissionDeleteAsync(
		drive.permissions
			.delete({ fileId: input.fileId, permissionId: input.permissionId, supportsAllDrives: false })
			.then(() => null)
	);
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
