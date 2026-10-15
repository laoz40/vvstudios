import { z } from "zod";
import type { DriveError } from "#convex/drive/lib/googleDrive";

export const googleProviderErrorSchema = z.object({
	status: z.number().optional(),
	response: z.object({ status: z.number().optional() }).optional()
});

export const googleShareErrorSchema = z.object({
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

export function isMissingGoogleAccountShareMessage(message: string) {
	return /does not have a Google Account|not connected to a Google account|no Google account associated/i.test(
		message
	);
}

export function driveErrorReason(
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

export function driveFolderLookupReason(
	fallback: DriveError["reason"],
	parsedProviderError: ReturnType<typeof googleProviderErrorSchema.safeParse>
) {
	const code = parsedProviderError.success ? providerStatus(parsedProviderError.data) : null;

	if (code === 404) {
		return { reason: "GOOGLE_DRIVE_FOLDER_MISSING" as const };
	}

	return driveErrorReason(fallback, parsedProviderError);
}

export function drivePermissionDeleteReason(
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
