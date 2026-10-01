import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { loadLocalEnvFiles } from "../../../scripts/load-env.ts";

const execFileAsync = promisify(execFile);

export const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(SKILL_DIR, "../../..");

export const STATE_DIR = path.join(SKILL_DIR, "state");

export const PID_FILE = path.join(STATE_DIR, "dev.pid");

export const SPAWN_PID_FILE = path.join(STATE_DIR, "dev.spawn.pid");

export const LOG_FILE = path.join(STATE_DIR, "dev.log");

export const BASE_URL = "http://localhost:3000";

export const DEV_PORT = 3000;

export const TITLE_PATTERN = /Podcast Studio Hire Sydney \| VV Studios/;

export const REQUIRED_ENV_KEYS = [
	"VITE_CONVEX_URL",
	"VITE_CLERK_PUBLISHABLE_KEY",
	"VITE_STRIPE_PUBLISHABLE_KEY",
	"VITE_FREE_TOUR_URL"
] as const;

export function loadProjectEnv() {
	loadLocalEnvFiles(REPO_ROOT);
}

export function ensureStateDir() {
	fs.mkdirSync(STATE_DIR, { recursive: true });
}

function readPidFile(filePath: string): number | null {
	if (!fs.existsSync(filePath)) {
		return null;
	}

	const raw = fs.readFileSync(filePath, "utf8").trim();
	const pid = Number.parseInt(raw, 10);

	if (!Number.isFinite(pid) || pid <= 0) {
		return null;
	}

	return pid;
}

export function readRecordedPid(): number | null {
	return readPidFile(PID_FILE);
}

export function writeRecordedPid(pid: number) {
	ensureStateDir();
	fs.writeFileSync(PID_FILE, String(pid));
}

export function writeSpawnPid(pid: number) {
	ensureStateDir();
	fs.writeFileSync(SPAWN_PID_FILE, String(pid));
}

export function readSpawnPid(): number | null {
	return readPidFile(SPAWN_PID_FILE);
}

export function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);

		return true;
	} catch {
		return false;
	}
}

export function missingEnvKeys(): string[] {
	loadProjectEnv();

	return REQUIRED_ENV_KEYS.filter((key) => {
		const value = process.env[key];

		return value === undefined || value.trim() === "";
	});
}

export async function getPortListenerPid(port = DEV_PORT): Promise<number | null> {
	try {
		const { stdout } = await execFileAsync("ss", ["-H", "-tlnp", `sport = :${port}`]);
		const match = stdout.match(/pid=(\d+)/u);

		if (match === null) {
			return null;
		}

		return Number.parseInt(match[1], 10);
	} catch {
		return null;
	}
}

export async function fetchHomeTitle(): Promise<string | null> {
	try {
		const response = await fetch(BASE_URL, {
			headers: { Accept: "text/html" },
			signal: AbortSignal.timeout(8_000)
		});

		if (!response.ok) {
			return null;
		}

		const html = await response.text();
		const match = html.match(/<title[^>]*>([^<]+)<\/title>/iu);

		return match?.[1]?.trim() ?? null;
	} catch {
		return null;
	}
}

export function titleMatches(title: string | null): boolean {
	return title !== null && TITLE_PATTERN.test(title);
}
