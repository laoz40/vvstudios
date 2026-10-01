#!/usr/bin/env bun
import fs from "node:fs";
import {
	BASE_URL,
	ensureStateDir,
	fetchHomeTitle,
	getPortListenerPid,
	isProcessAlive,
	loadProjectEnv,
	LOG_FILE,
	missingEnvKeys,
	readRecordedPid,
	REPO_ROOT,
	titleMatches,
	writeRecordedPid,
	writeSpawnPid
} from "./lib.ts";

const HELP = `verify-vvstudios launch — start bun run dev when port 3000 is free or already ours

Usage:
  bun .agents/skills/verify-vvstudios/launch.ts

Writes state/dev.pid (listener pid) and state/dev.log. Does not print secrets.
`;

const READY_TIMEOUT_MS = 60_000;
const POLL_MS = 500;

function fail(reason: string): never {
	console.error(reason);
	process.exit(1);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
	console.log(HELP.trim());
	process.exit(0);
}

const missing = missingEnvKeys();
if (missing.length > 0) {
	fail(`Missing required env: ${missing.join(", ")} (set in .env.local)`);
}

loadProjectEnv();
ensureStateDir();

const listenerPid = await getPortListenerPid();

if (listenerPid !== null) {
	const title = await fetchHomeTitle();
	if (!titleMatches(title)) {
		fail(`Port 3000 is busy but title check failed`);
	}

	const recordedPid = readRecordedPid();
	if (
		recordedPid !== null &&
		isProcessAlive(recordedPid) &&
		recordedPid === listenerPid
	) {
		console.log(`Ready: ${BASE_URL} (pid ${recordedPid})`);
		process.exit(0);
	}

	fail(
		`Refuse: port 3000 is in use by foreign pid ${listenerPid}; will not start another Vite instance`
	);
}

const logStream = fs.openSync(LOG_FILE, "a");
fs.writeSync(logStream, `\n--- launch ${new Date().toISOString()} ---\n`);

const child = Bun.spawn(["bun", "run", "dev"], {
	cwd: REPO_ROOT,
	env: process.env,
	stdout: logStream,
	stderr: logStream,
	detached: true
});

child.unref();

if (child.pid !== undefined) {
	writeSpawnPid(child.pid);
}

const startedAt = Date.now();
let readyListener: number | null = null;

while (Date.now() - startedAt < READY_TIMEOUT_MS) {
	await Bun.sleep(POLL_MS);
	readyListener = await getPortListenerPid();
	if (readyListener === null) {
		continue;
	}

	const title = await fetchHomeTitle();
	if (titleMatches(title)) {
		writeRecordedPid(readyListener);
		console.log(`Ready: ${BASE_URL} (pid ${readyListener}, spawn pid ${child.pid})`);
		fs.closeSync(logStream);
		process.exit(0);
	}
}

if (child.pid !== undefined) {
	try {
		process.kill(child.pid, "SIGTERM");
	} catch {
		// spawn already gone
	}
}

fs.closeSync(logStream);
fail(`Timed out waiting for ${BASE_URL} with expected document title`);
