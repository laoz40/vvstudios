/**
 * Search display ordering applies to the matches loaded so far.
 * 1. Session sorting supports descending start time and ascending creation time.
 * 2. Package sorting supports descending creation time.
 * 3. Later pages can move an earlier session or newer package ahead of loaded rows.
 *    Sorting leaves the original pagination order intact.
 */
import { describe, expect, test } from "vitest";
import {
	sortAdminSearchPackages,
	sortAdminSearchSessions
} from "#studio/features/admin/lib/admin-search-client-sort";

describe("sortAdminSearchSessions", () => {
	test("reorders loaded matches when a later page contains an earlier session", () => {
		const firstPage = [
			{ _id: "a", sessionStartAt: 200, pendingPaymentCreatedAt: 1 },
			{ _id: "b", sessionStartAt: 300, pendingPaymentCreatedAt: 2 }
		];

		expect(sortAdminSearchSessions(firstPage, []).map((row) => row._id)).toEqual(["a", "b"]);
		const loaded = [...firstPage, { _id: "c", sessionStartAt: 100, pendingPaymentCreatedAt: 3 }];
		expect(sortAdminSearchSessions(loaded, []).map((row) => row._id)).toEqual(["c", "a", "b"]);
		expect(loaded.map((row) => row._id)).toEqual(["a", "b", "c"]);
	});

	test("sorts by session start descending", () => {
		const sessions = [
			{ _id: "a", sessionStartAt: 100, pendingPaymentCreatedAt: 1 },
			{ _id: "b", sessionStartAt: 300, pendingPaymentCreatedAt: 2 },
			{ _id: "c", sessionStartAt: 200, pendingPaymentCreatedAt: 3 }
		];

		const sorted = sortAdminSearchSessions(sessions, [{ id: "session", desc: true }]);

		expect(sorted.map((session) => session._id)).toEqual(["b", "c", "a"]);
	});

	test("sorts by created ascending", () => {
		const sessions = [
			{ _id: "a", sessionStartAt: 100, pendingPaymentCreatedAt: 30 },
			{ _id: "b", sessionStartAt: 300, pendingPaymentCreatedAt: 10 },
			{ _id: "c", sessionStartAt: 200, pendingPaymentCreatedAt: 20 }
		];

		const sorted = sortAdminSearchSessions(sessions, [{ id: "createdAt", desc: false }]);

		expect(sorted.map((session) => session._id)).toEqual(["b", "c", "a"]);
	});
});

describe("sortAdminSearchPackages", () => {
	test("reorders loaded matches when a later page contains a newer package", () => {
		const firstPage = [
			{ _id: "a", createdAt: 200 },
			{ _id: "b", createdAt: 100 }
		];

		expect(
			sortAdminSearchPackages(firstPage, { isDescending: true }).map((row) => row._id)
		).toEqual(["a", "b"]);
		const loaded = [...firstPage, { _id: "c", createdAt: 300 }];
		expect(sortAdminSearchPackages(loaded, { isDescending: true }).map((row) => row._id)).toEqual([
			"c",
			"a",
			"b"
		]);
		expect(loaded.map((row) => row._id)).toEqual(["a", "b", "c"]);
	});

	test("sorts by created descending", () => {
		const packages = [
			{ _id: "a", createdAt: 100 },
			{ _id: "b", createdAt: 300 },
			{ _id: "c", createdAt: 200 }
		];

		const sorted = sortAdminSearchPackages(packages, { isDescending: true });

		expect(sorted.map((packageRecord) => packageRecord._id)).toEqual(["b", "c", "a"]);
	});
});
