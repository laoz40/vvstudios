#!/usr/bin/env bun
import fs from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import {
	isProcessAlive,
	LOG_FILE,
	PID_FILE,
	SPAWN_PID_FILE,
	readRecordedPid,
	readSpawnPid
} from "./lib.ts";

const HELP = `verify-vvstudios cleanup — stop dev server started by this skill only

Usage:
  bun .agents/skills/verify-vvstudios/cleanup.ts

Kills pids in state/dev.pid and state/dev.spawn.pid if still alive.
Removes those pid files and state/dev.log.
Does not delete tmp/verify-vvstudios evidence or pkill by process name.
`;

if (process.argv.includes("--help") || process.argv.includes("-h")) {
	console.log(HELP.trim());
	process.exit(0);
}

function stopPid(pid: number, label: string) {
	if (!isProcessAlive(pid)) {
		console.log(`${label} pid ${pid} was not running`);

		return;
	}

	try {
		process.kill(pid, "SIGTERM");
	} catch (error) {
		console.error(`Failed to signal ${label} pid ${pid}:`, error);
		process.exit(1);
	}
}

const spawnPid = readSpawnPid();

const recordedPid = readRecordedPid();

if (spawnPid !== null) {
	stopPid(spawnPid, "spawn");
}

if (recordedPid !== null && recordedPid !== spawnPid) {
	stopPid(recordedPid, "listener");
}

await delay(500);

for (const pid of [spawnPid, recordedPid]) {
	if (pid !== null && isProcessAlive(pid)) {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			// process may have exited between checks
		}
	}
}

if (recordedPid !== null || spawnPid !== null) {
	console.log(
		`Stopped recorded processes (listener ${recordedPid ?? "none"}, spawn ${spawnPid ?? "none"})`
	);
}

for (const file of [PID_FILE, SPAWN_PID_FILE, LOG_FILE]) {
	if (fs.existsSync(file)) {
		fs.unlinkSync(file);
	}
}

console.log("Cleanup complete (evidence under tmp/verify-vvstudios/ kept)");
