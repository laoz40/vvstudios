#!/usr/bin/env bun
import fs from "node:fs";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
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

	if (recordedPid !== null && isProcessAlive(recordedPid) && recordedPid === listenerPid) {
		console.log(`Ready: ${BASE_URL} (pid ${recordedPid})`);
		process.exit(0);
	}

	fail(
		`Refuse: port 3000 is in use by foreign pid ${listenerPid}; will not start another Vite instance`
	);
}

const logStream = fs.openSync(LOG_FILE, "a");

fs.writeSync(logStream, `\n--- launch ${new Date().toISOString()} ---\n`);

const child = spawn("bun", ["run", "dev"], {
	cwd: REPO_ROOT,
	detached: true,
	stdio: ["ignore", logStream, logStream]
});

child.unref();

if (child.pid !== undefined) {
	writeSpawnPid(child.pid);
}

async function waitUntilReady(deadline: number): Promise<number | null> {
	if (Date.now() >= deadline) {
		return null;
	}

	const readyListener = await getPortListenerPid();
	const title = await fetchHomeTitle();

	if (readyListener !== null && titleMatches(title)) {
		return readyListener;
	}

	await delay(POLL_MS);

	return waitUntilReady(deadline);
}

const readyListener = await waitUntilReady(Date.now() + READY_TIMEOUT_MS);

if (readyListener !== null) {
	writeRecordedPid(readyListener);
	console.log(`Ready: ${BASE_URL} (pid ${readyListener}, spawn pid ${child.pid})`);
	fs.closeSync(logStream);
	process.exit(0);
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
