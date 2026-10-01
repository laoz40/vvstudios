#!/usr/bin/env bun
import {
	fetchHomeTitle,
	getPortListenerPid,
	isProcessAlive,
	missingEnvKeys,
	readRecordedPid,
	titleMatches
} from "./lib.ts";

const HELP = `verify-vvstudios doctor — read-only preflight for driving VV Studios at localhost:3000

Usage:
  bun .agents/skills/verify-vvstudios/doctor.ts

Exit 0 when the environment is safe to launch or drive our dev server.
Exit 1 with a one-line reason otherwise.
`;

function fail(reason: string): never {
	console.error(reason);
	process.exit(1);
}

function pass(message = "OK: ready to drive VV Studios on http://localhost:3000") {
	console.log(message);
	process.exit(0);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
	console.log(HELP.trim());
	process.exit(0);
}

const missing = missingEnvKeys();

if (missing.length > 0) {
	fail(`Missing required env: ${missing.join(", ")} (set in .env.local)`);
}

const listenerPid = await getPortListenerPid();

if (listenerPid === null) {
	pass("OK: port 3000 is free; run launch.ts before driving");
}

const title = await fetchHomeTitle();

if (!titleMatches(title)) {
	const got = title ? JSON.stringify(title) : "no response";

	fail("Port 3000 is listening but home title is wrong (got " + got + ")");
}

const recordedPid = readRecordedPid();

if (recordedPid === null) {
	fail(
		"Refuse: port 3000 is in use by pid " +
			String(listenerPid) +
			" with no matching .agents/skills/verify-vvstudios/state/dev.pid"
	);
}

if (!isProcessAlive(recordedPid)) {
	fail(`Refuse: recorded pid ${recordedPid} is not running (listener is pid ${listenerPid})`);
}

if (recordedPid !== listenerPid) {
	fail(`Refuse: port 3000 owned by pid ${listenerPid}, not our recorded pid ${recordedPid}`);
}

pass("OK: our dev server is up on http://localhost:3000");
