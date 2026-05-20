export function parseGoogleDriveLink(driveLink: string) {
	const trimmedLink = driveLink.trim();

	if (!trimmedLink) {
		return null;
	}

	try {
		const url = new URL(trimmedLink);
		const isGoogleDriveHost =
			url.hostname === "drive.google.com" || url.hostname.endsWith(".drive.google.com");

		if (url.protocol !== "https:" || !isGoogleDriveHost) {
			return null;
		}

		return url.toString();
	} catch {
		return null;
	}
}
