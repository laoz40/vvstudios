"use node";

import { google, type drive_v3 } from "googleapis";
import { ResultAsync, err, ok } from "neverthrow";
import { z } from "zod";
import { getGoogleOAuthClient } from "#convex/lib/googleAuth";

export { formatDriveSessionFolderName as getSessionFolderName } from "#studio/lib/bookingdatetime";

export const GOOGLE_DRIVE_CHILD_FOLDER_NAMES = ["Raw Media", "Assets", "Deliverables"] as const;
export type DriveChildFolderName = (typeof GOOGLE_DRIVE_CHILD_FOLDER_NAMES)[number];

const driveFolderSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	webViewLink: z.url()
});

export type DriveClient = drive_v3.Drive;
export type SavedDriveFolder = z.infer<typeof driveFolderSchema>;
export type DriveError = {
	reason:
		| "GOOGLE_DRIVE_AUTH_FAILED"
		| "GOOGLE_DRIVE_FOLDER_CREATE_FAILED"
		| "GOOGLE_DRIVE_FOLDER_RESPONSE_INVALID"
		| "GOOGLE_DRIVE_LIMITED_ACCESS_FAILED";
};

function mapDriveError(error: unknown, fallback: DriveError["reason"]) {
	if (typeof error === "object" && error !== null && "code" in error) {
		const code = error.code;
		if (code === 401 || code === 403) return { reason: "GOOGLE_DRIVE_AUTH_FAILED" as const };
	}
	return { reason: fallback };
}

export function loadDriveClient() {
	return ResultAsync.fromPromise(
		Promise.resolve().then(() => google.drive({ version: "v3", auth: getGoogleOAuthClient() })),
		(error) => mapDriveError(error, "GOOGLE_DRIVE_AUTH_FAILED")
	);
}

export function createDriveFolder(drive: DriveClient, input: { name: string; parentId: string }) {
	return ResultAsync.fromPromise(
		drive.files.create({
			fields: "id,name,webViewLink",
			requestBody: {
				name: input.name,
				mimeType: "application/vnd.google-apps.folder",
				parents: [input.parentId],
				writersCanShare: false
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

export function limitRawMediaFolderAccess(drive: DriveClient, folderId: string) {
	return ResultAsync.fromPromise(
		drive.files.update({
			fileId: folderId,
			fields: "id",
			requestBody: { inheritedPermissionsDisabled: true, writersCanShare: false }
		}),
		(error) => mapDriveError(error, "GOOGLE_DRIVE_LIMITED_ACCESS_FAILED")
	).map(() => null);
}

export function normalizeDriveEmail(email: string) {
	return email.trim().toLowerCase();
}

export function getClientFolderName(input: { accountName: string; contactName: string }) {
	const clientName = input.accountName.trim() || input.contactName.trim();
	return `${clientName} (VV Studios)`;
}
