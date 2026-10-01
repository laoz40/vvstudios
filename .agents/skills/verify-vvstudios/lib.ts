import fs from "node:fs";
import path from "node:path";
import { loadLocalEnvFiles } from "../../../scripts/load-env.ts";

export const SKILL_DIR = import.meta.dir;
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

export function readRecordedPid(): number | null {
	if (!fs.existsSync(PID_FILE)) {
		return null;
	}

	const raw = fs.readFileSync(PID_FILE, "utf8").trim();
	const pid = Number.parseInt(raw, 10);

	return Number.isFinite(pid) && pid > 0 ? pid : null;
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
	if (!fs.existsSync(SPAWN_PID_FILE)) {
		return null;
	}

	const raw = fs.readFileSync(SPAWN_PID_FILE, "utf8").trim();
	const pid = Number.parseInt(raw, 10);

	return Number.isFinite(pid) && pid > 0 ? pid : null;
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
	const proc = Bun.spawn(["ss", "-H", "-tlnp", `sport = :${port}`], {
		stdout: "pipe",
		stderr: "pipe"
	});
	const text = await new Response(proc.stdout).text();
	await proc.exited;

	if (proc.exitCode !== 0) {
		return null;
	}

	const match = text.match(/pid=(\d+)/u);
	return match ? Number.parseInt(match[1]!, 10) : null;
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

export async function isPortListening(port = DEV_PORT): Promise<boolean> {
	const listener = await getPortListenerPid(port);
	return listener !== null;
}
