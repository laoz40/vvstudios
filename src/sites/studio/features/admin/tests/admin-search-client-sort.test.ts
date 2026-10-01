import { describe, expect, test } from "vitest";
import {
	sortAdminSearchPackages,
	sortAdminSearchSessions
} from "#studio/features/admin/lib/admin-search-client-sort";

describe("sortAdminSearchSessions", () => {
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
