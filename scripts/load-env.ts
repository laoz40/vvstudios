import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function loadLocalEnvFiles(projectRoot: string) {
	for (const fileName of [".env.local", ".env"]) {
		loadEnvFile(path.join(projectRoot, fileName));
	}
}

function loadEnvFile(filePath: string) {
	if (!fs.existsSync(filePath)) {
		return;
	}

	for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/u)) {
		const trimmedLine = line.trim();

		if (!trimmedLine || trimmedLine.startsWith("#")) {
			continue;
		}

		const equalsIndex = trimmedLine.indexOf("=");

		if (equalsIndex === -1) {
			continue;
		}

		const key = trimmedLine.slice(0, equalsIndex).trim();
		const rawValue = trimmedLine.slice(equalsIndex + 1).trim();

		if (!key || process.env[key] !== undefined) {
			continue;
		}

		process.env[key] = stripWrappingQuotes(rawValue);
	}
}

function stripWrappingQuotes(value: string) {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}

	return value;
}

export function loadLocalEnvFilesFromModule(moduleUrl: string | URL) {
	const modulePath = fileURLToPath(moduleUrl);
	loadLocalEnvFiles(path.resolve(path.dirname(modulePath)));
}
