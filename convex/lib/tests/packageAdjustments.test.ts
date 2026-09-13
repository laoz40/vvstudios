/**
 * Package adjustment math and invoice claim guards.
 *
 * 1. evaluatePackageAdjustment
 *    Waits for ongoing sessions, totals completed Remote Podcast sessions, and rejects bad durations.
 *
 * 2. validatePackageAdjustmentEmailClaim
 *    Rejects duplicate sends, in-progress claims, and wrong status for automatic vs retry attempts.
 *
 * 3. requirePackageAdjustmentPaymentEligibility
 *    Blocks payment before send or due date; allows sent or overdue invoices.
 */
import { describe, expect, test } from "vitest";
import type { Doc, Id } from "#convex/_generated/dataModel";
import {
	evaluatePackageAdjustment,
	PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS,
	PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS,
	REMOTE_PODCAST_ADJUSTMENT_RATE,
	requirePackageAdjustmentPaymentEligibility,
	validatePackageAdjustmentEmailClaim
} from "#convex/lib/packageAdjustments";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";

const now = Date.parse("2030-01-10T00:00:00.000Z");

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

const completedSessionStartAt = now - 2 * MILLISECONDS_PER_HOUR;

const ongoingSessionStartAt = now - MILLISECONDS_PER_HOUR / 2;

function packageSession(
	id: string,
	sessionStartAt: number,
	duration: string,
	addons: BookingAddon[] = []
): Doc<"bookings"> {
	// SAFETY: Unit test fixture; evaluatePackageAdjustment only reads _id, duration, sessionStartAt, and addons.
	return { _id: id as Id<"bookings">, sessionStartAt, duration, addons } as Doc<"bookings">;
}

function invoiceAdjustment(
	overrides: Partial<Extract<Doc<"packageAdjustments">, { outcome: "invoice_required" }>> = {}
): Extract<Doc<"packageAdjustments">, { outcome: "invoice_required" }> {
	return {
		outcome: "invoice_required",
		packageId: "package1" as Id<"packages">,
		trigger: "package_expired",
		remotePodcastBookingIds: [],
		quantity: 1,
		rate: REMOTE_PODCAST_ADJUSTMENT_RATE,
		totalAmount: REMOTE_PODCAST_ADJUSTMENT_RATE,
		invoiceNumber: "TEST-ADJ-1",
		createdAt: now,
		invoiceDueAt: now + PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS,
		invoiceEmailStatus: "pending",
		paymentStatus: "unpaid",
		...overrides
	};
}

describe("evaluatePackageAdjustment", () => {
	test("returns ready with zero quantity when no sessions exist", () => {
		const evaluation = evaluatePackageAdjustment([], now);

		expect(evaluation).toEqual({
			kind: "ready",
			remotePodcastBookingIds: [],
			quantity: 0,
			totalAmount: 0
		});
	});

	test("waits until ongoing sessions end", () => {
		const ongoingSession = packageSession("booking-ongoing", ongoingSessionStartAt, "1h");

		const evaluation = evaluatePackageAdjustment([ongoingSession], now);

		expect(evaluation).toEqual({
			kind: "wait_for_sessions_to_end",
			nextCheckAt: ongoingSessionStartAt + MILLISECONDS_PER_HOUR
		});
	});

	test("counts quantity and total from completed Remote Podcast sessions", () => {
		const remotePodcastSessions = [
			packageSession("booking-remote-1", completedSessionStartAt, "1h", ["Remote Podcast"]),
			packageSession("booking-remote-2", completedSessionStartAt, "2h", ["Remote Podcast"]),
			packageSession("booking-plain", completedSessionStartAt, "1h", [])
		];

		const evaluation = evaluatePackageAdjustment(remotePodcastSessions, now);

		expect(evaluation).toEqual({
			kind: "ready",
			remotePodcastBookingIds: [
				"booking-remote-1" as Id<"bookings">,
				"booking-remote-2" as Id<"bookings">
			],
			quantity: 2,
			totalAmount: 2 * REMOTE_PODCAST_ADJUSTMENT_RATE
		});
	});

	test("returns invalid_duration when a session duration is unrecognized", () => {
		const evaluation = evaluatePackageAdjustment(
			[packageSession("booking-bad-duration", completedSessionStartAt, "90m")],
			now
		);

		expect(evaluation).toEqual({ kind: "invalid_duration" });
	});
});

describe("validatePackageAdjustmentEmailClaim", () => {
	test("rejects a claim when the invoice email was already sent", () => {
		const result = validatePackageAdjustmentEmailClaim(
			invoiceAdjustment({ invoiceEmailStatus: "sent" }),
			{ attempt: "automatic", now }
		);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" });
		}
	});

	test("rejects a claim while another send is still in progress", () => {
		const claimedAt = now - 5 * 60 * 1000;

		const result = validatePackageAdjustmentEmailClaim(
			invoiceAdjustment({ invoiceEmailStatus: "pending", invoiceEmailClaimedAt: claimedAt }),
			{ attempt: "automatic", now }
		);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" });
		}
	});

	test("rejects automatic claims unless the invoice email is pending", () => {
		const result = validatePackageAdjustmentEmailClaim(
			invoiceAdjustment({ invoiceEmailStatus: "failed" }),
			{ attempt: "automatic", now }
		);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" });
		}
	});

	test("rejects retry claims unless the invoice email failed", () => {
		const result = validatePackageAdjustmentEmailClaim(
			invoiceAdjustment({ invoiceEmailStatus: "pending" }),
			{ attempt: "retry", now }
		);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "PACKAGE_ADJUSTMENT_EMAIL_NOT_SENDABLE" });
		}
	});

	test("allows automatic claims on pending invoices", () => {
		const adjustment = invoiceAdjustment({ invoiceEmailStatus: "pending" });

		const result = validatePackageAdjustmentEmailClaim(adjustment, { attempt: "automatic", now });

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual(adjustment);
		}
	});

	test("allows retry claims on failed invoices after the claim timeout", () => {
		const adjustment = invoiceAdjustment({
			invoiceEmailStatus: "failed",
			invoiceEmailClaimedAt: now - PACKAGE_ADJUSTMENT_EMAIL_CLAIM_TIMEOUT_MS - 1
		});

		const result = validatePackageAdjustmentEmailClaim(adjustment, { attempt: "retry", now });

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual(adjustment);
		}
	});
});

describe("requirePackageAdjustmentPaymentEligibility", () => {
	test("rejects payment when the invoice is not sent and not yet due", () => {
		const result = requirePackageAdjustmentPaymentEligibility(
			invoiceAdjustment({
				invoiceEmailStatus: "pending",
				invoiceDueAt: now + PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS
			}),
			now
		);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toEqual({ reason: "PACKAGE_ADJUSTMENT_INVOICE_NOT_SENT" });
		}
	});

	test("allows payment after the invoice email is sent", () => {
		const adjustment = invoiceAdjustment({ invoiceEmailStatus: "sent" });

		const result = requirePackageAdjustmentPaymentEligibility(adjustment, now);

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual(adjustment);
		}
	});

	test("allows payment once the invoice is overdue even if email is still pending", () => {
		const adjustment = invoiceAdjustment({ invoiceEmailStatus: "pending", invoiceDueAt: now - 1 });

		const result = requirePackageAdjustmentPaymentEligibility(adjustment, now);

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual(adjustment);
		}
	});
});
