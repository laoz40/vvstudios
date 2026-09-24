/**
 * Admin session edit field detection and patch building.
 *
 * 1. Field change summary
 *    Timing, pricing, and calendar-related flags reflect which draft fields changed.
 *
 * 2. Admin update patch
 *    buildAdminSessionUpdatePatch recalculates sessionStartAt and clears reminders on schedule changes.
 *
 * 3. Timing comparison
 *    didSessionTimingChange ignores contact-only edits.
 */
import { describe, expect, test } from "vitest";
import type { Doc } from "#convex/_generated/dataModel";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import {
	buildAdminSessionUpdatePatch,
	didSessionTimingChange,
	getSessionEditFieldChanges
} from "#convex/lib/sessionAdminEdit";
import { testBookingId } from "#convex/lib/tests/testIds";

const timeZone = "Australia/Sydney";

const sessionStartAt = Date.parse("2030-01-09T23:00:00.000Z");

const rescheduledSessionStartAt = Date.parse("2030-01-10T23:00:00.000Z");

type SessionEditDraft = {
	name: string;
	phone: string;
	accountName: string;
	email: string;
	date: string;
	time: string;
	duration: string;
	service: string;
	addons: BookingAddon[];
};

function baseSessionValues(overrides: Partial<SessionEditDraft> = {}): SessionEditDraft {
	return {
		name: "Test customer",
		phone: "0400000000",
		accountName: "Test account",
		email: "customer@example.com",
		date: "2030-01-10",
		time: "10:00",
		duration: "1h",
		service: "Table Setup",
		addons: [],
		...overrides
	};
}

function baseBooking(overrides: Partial<Doc<"bookings">> = {}): Doc<"bookings"> {
	// SAFETY: Unit tests only pass booking fields read by session admin edit helpers.
	return {
		_id: testBookingId("booking-1"),
		_creationTime: 0,
		name: "Test customer",
		phone: "0400000000",
		accountName: "Test account",
		email: "customer@example.com",
		date: "2030-01-10",
		time: "10:00",
		duration: "1h",
		sessionStartAt,
		service: "Table Setup",
		addons: [],
		status: "confirmed",
		pendingPaymentCreatedAt: 0,
		...overrides
	};
}

describe("getSessionEditFieldChanges", () => {
	test("flags timing and pricing when duration changes", () => {
		const session = baseBooking();
		const values = baseSessionValues({ duration: "2h" });

		expect(getSessionEditFieldChanges(session, values)).toMatchObject({
			timingFieldsChanged: true,
			pricingFieldsChanged: true,
			googleEventFieldsChanged: true
		});
	});

	test("flags pricing when add-ons change without timing edits", () => {
		const session = baseBooking();
		const values = baseSessionValues({ addons: ["Teleprompter"] satisfies BookingAddon[] });

		expect(getSessionEditFieldChanges(session, values)).toMatchObject({
			timingFieldsChanged: false,
			pricingFieldsChanged: true,
			googleEventFieldsChanged: true
		});
	});

	test("leaves timing and pricing unchanged for name-only edits", () => {
		const session = baseBooking();
		const values = baseSessionValues({ name: "Updated customer" });

		expect(getSessionEditFieldChanges(session, values)).toMatchObject({
			timingFieldsChanged: false,
			pricingFieldsChanged: false,
			googleEventFieldsChanged: true
		});
	});
});

describe("buildAdminSessionUpdatePatch", () => {
	test("recalculates sessionStartAt from date and time", () => {
		const session = baseBooking();
		const values = baseSessionValues({ date: "2030-01-11", time: "10:00", duration: "2h" });

		const patch = buildAdminSessionUpdatePatch({ session, timeZone, values });

		expect(patch.isOk()).toBe(true);

		if (patch.isOk()) {
			expect(patch.value.sessionStartAt).toBe(rescheduledSessionStartAt);
			expect(patch.value.duration).toBe("2h");
			expect(patch.value.email).toBe("customer@example.com");
		}
	});

	test("clears reminder fields when the schedule changes", () => {
		const session = baseBooking({
			reminderEmailClaimedAt: 1,
			reminderEmailSentAt: 2,
			reminderEmailFailureCode: "FAILED"
		});

		const values = baseSessionValues({ duration: "2h" });
		const patch = buildAdminSessionUpdatePatch({ session, timeZone, values });

		expect(patch.isOk()).toBe(true);

		if (patch.isOk()) {
			expect(patch.value.reminderEmailClaimedAt).toBeUndefined();
			expect(patch.value.reminderEmailSentAt).toBeUndefined();
			expect(patch.value.reminderEmailFailureCode).toBeUndefined();
		}
	});

	test("does not include reminder clears when only contact details change", () => {
		const session = baseBooking({ reminderEmailClaimedAt: 1, reminderEmailSentAt: 2 });
		const values = baseSessionValues({ name: "Updated customer", email: "  New@Example.com " });

		const patch = buildAdminSessionUpdatePatch({ session, timeZone, values });

		expect(patch.isOk()).toBe(true);

		if (patch.isOk()) {
			expect(patch.value.name).toBe("Updated customer");
			expect(patch.value.email).toBe("new@example.com");
			expect(patch.value).not.toHaveProperty("reminderEmailClaimedAt");
			expect(patch.value).not.toHaveProperty("reminderEmailSentAt");
			expect(patch.value).not.toHaveProperty("reminderEmailFailureCode");
		}
	});
});

describe("didSessionTimingChange", () => {
	test("returns false when only contact fields differ", () => {
		expect(
			didSessionTimingChange(
				{ date: "2030-01-10", time: "10:00", duration: "1h" },
				{ date: "2030-01-10", time: "10:00", duration: "1h" }
			)
		).toBe(false);
	});

	test("returns true when the session date changes", () => {
		expect(
			didSessionTimingChange(
				{ date: "2030-01-10", time: "10:00", duration: "1h" },
				{ date: "2030-01-11", time: "10:00", duration: "1h" }
			)
		).toBe(true);
	});
});
