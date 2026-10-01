/**
 * Deliverables review host notification tests:
 *
 * 1. Editor review transition
 *    Only non-admin transitions into review should notify hosts.
 */
import type { UserIdentity } from "convex/server";
import { describe, expect, test } from "vitest";
import { shouldNotifyHostOfDeliverablesReview } from "#convex/lib/deliverablesReviewNotification";

const editorIdentity: UserIdentity = {
	tokenIdentifier: "https://clerk.example|editor",
	subject: "editor",
	issuer: "https://clerk.example",
	publicMetadata: { role: "editor" }
};

const adminIdentity: UserIdentity = {
	tokenIdentifier: "https://clerk.example|admin",
	subject: "admin",
	issuer: "https://clerk.example",
	publicMetadata: { role: "admin" }
};

describe("deliverables review host notification", () => {
	test("editor moving into review should notify hosts", () => {
		expect(
			shouldNotifyHostOfDeliverablesReview({
				identity: editorIdentity,
				previousEditStatus: "editing",
				nextEditStatus: "review"
			})
		).toBe(true);
	});

	test("admin moving into review should not notify hosts", () => {
		expect(
			shouldNotifyHostOfDeliverablesReview({
				identity: adminIdentity,
				previousEditStatus: "editing",
				nextEditStatus: "review"
			})
		).toBe(false);
	});

	test("staying on review should not notify hosts", () => {
		expect(
			shouldNotifyHostOfDeliverablesReview({
				identity: editorIdentity,
				previousEditStatus: "review",
				nextEditStatus: "review"
			})
		).toBe(false);
	});
});
