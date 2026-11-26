import {
	getEditingAddonQuantity,
	type BookingAddonQuantities,
	type QuantityTrackedAddon
} from "#/domain/booking/addon-quantities";
import type { BookingAddon } from "#/domain/booking/catalog";

const REVISION_TIME_ZONE = "Australia/Sydney";

export const REVISION_WINDOW_BUSINESS_DAYS = 2;

export const PAID_REVISION_PRICE_AUD = 50;

export const MAX_PAID_REVISION_ROUNDS = 5;

export interface DeliverablesRevisionInfo {
	feedbackUrl: string;
	freeRounds: number;
	scopeSummary?: string;
	requiresClipNumber: boolean;
}

type RevisionChangeScope = "corrections_only" | "stylised_allowed";

type RevisionAddonRule = {
	readonly freeRounds: number;
	readonly scope: RevisionChangeScope;
	readonly scopeSummary: string;
	readonly requiresClipNumber: boolean;
};

const REVISION_RULES_BY_ADDON = {
	"Essential Edit": {
		freeRounds: 1,
		scope: "corrections_only",
		scopeSummary: "Corrections to cuts, timing, and text errors",
		requiresClipNumber: false
	},
	"Clip Volume Pack": {
		freeRounds: 1,
		scope: "corrections_only",
		scopeSummary: "Corrections to cuts, timing, and text errors",
		requiresClipNumber: true
	},
	"Complete Edit": {
		freeRounds: 2,
		scope: "stylised_allowed",
		scopeSummary: "Stylised changes allowed",
		requiresClipNumber: false
	},
	"Handcrafted Clips": {
		freeRounds: 2,
		scope: "stylised_allowed",
		scopeSummary: "Stylised changes allowed",
		requiresClipNumber: true
	}
} as const satisfies Record<QuantityTrackedAddon, RevisionAddonRule>;

export function getRevisionAddonRule(addOn: QuantityTrackedAddon): RevisionAddonRule {
	return REVISION_RULES_BY_ADDON[addOn];
}

export function isSessionRevisionEligible(session: {
	editStatusScope?: "session" | "edit";
	editDeliveryMode?: "studio_review_only";
}) {
	return session.editStatusScope === "edit" && session.editDeliveryMode !== "studio_review_only";
}

export function isEditPurchasedForSession(
	session: BookingAddonQuantities & { addons: readonly BookingAddon[] },
	edit: { addOn: QuantityTrackedAddon; addOnItemNumber: number }
) {
	return (
		session.addons.includes(edit.addOn) &&
		edit.addOnItemNumber <= getEditingAddonQuantity(edit.addOn, session, 1)
	);
}

export function isEditRevisionEligible(
	session: BookingAddonQuantities & {
		addons: readonly BookingAddon[];
		editStatusScope?: "session" | "edit";
		editDeliveryMode?: "studio_review_only";
	},
	edit: {
		addOn: QuantityTrackedAddon;
		addOnItemNumber: number;
		deliveredAt?: number;
		revisionWindowEndsAt?: number;
	}
) {
	if (!isSessionRevisionEligible(session) || !isEditPurchasedForSession(session, edit)) {
		return false;
	}

	// Deliveries made before client feedback links went live stay final even on resend.
	return !(edit.deliveredAt !== undefined && edit.revisionWindowEndsAt === undefined);
}

const sydneyPartsFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: REVISION_TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hour12: false,
	hourCycle: "h23"
});

const revisionDeadlineFormatter = new Intl.DateTimeFormat("en-AU", {
	timeZone: REVISION_TIME_ZONE,
	weekday: "short",
	day: "numeric",
	month: "short",
	hour: "numeric",
	minute: "2-digit",
	hour12: true,
	timeZoneName: "short"
});

function getSydneyParts(timestamp: number) {
	const parts = sydneyPartsFormatter.formatToParts(timestamp);

	const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value);

	const hour = valueOf("hour");

	return {
		year: valueOf("year"),
		month: valueOf("month"),
		day: valueOf("day"),
		hour: hour === 24 ? 0 : hour,
		minute: valueOf("minute"),
		second: valueOf("second")
	};
}

/**
 * Returns 11:59:59.999 pm Australia/Sydney on the Nth business day (Mon–Fri,
 * ignoring public holidays) after `deliveredAt`.
 */
export function getRevisionWindowEndsAt(
	deliveredAt: number,
	businessDays = REVISION_WINDOW_BUSINESS_DAYS
) {
	const { year, month, day } = getSydneyParts(deliveredAt);
	const cursor = new Date(Date.UTC(year, month - 1, day));
	let added = 0;

	while (added < businessDays) {
		cursor.setUTCDate(cursor.getUTCDate() + 1);
		const dayOfWeek = cursor.getUTCDay();

		if (dayOfWeek !== 0 && dayOfWeek !== 6) {
			added += 1;
		}
	}

	const targetYear = cursor.getUTCFullYear();
	const targetMonth = cursor.getUTCMonth() + 1;
	const targetDay = cursor.getUTCDate();
	const targetUtcMs = Date.UTC(targetYear, targetMonth - 1, targetDay, 23, 59, 59, 0);
	let guessUtcMs = targetUtcMs;

	for (let iteration = 0; iteration < 3; iteration += 1) {
		const zoned = getSydneyParts(guessUtcMs);

		const currentUtcMs = Date.UTC(
			zoned.year,
			zoned.month - 1,
			zoned.day,
			zoned.hour,
			zoned.minute,
			zoned.second,
			0
		);

		const diffMs = targetUtcMs - currentUtcMs;
		guessUtcMs += diffMs;

		if (diffMs === 0) break;
	}

	return guessUtcMs + 999;
}

function formatRevisionDeadline(windowEndsAt: number) {
	return revisionDeadlineFormatter.format(windowEndsAt);
}

type EditRevisionClosedReason = "pre_rollout" | "window_expired" | "allowance_exhausted";

type EditRevisionState =
	| { kind: "not_delivered"; statusLabel: "Not delivered yet" }
	| { kind: "open_free"; badge: "Free"; windowEndsAt: number; statusLabel: string }
	| {
			kind: "closed";
			badge: "Closed";
			windowEndsAt: number | null;
			closedReason: EditRevisionClosedReason;
			statusLabel: "Closed";
	  };

export function getEditRevisionState(input: {
	addOn: QuantityTrackedAddon;
	deliveredAt: number | undefined;
	revisionWindowEndsAt: number | undefined;
	freeRoundsUsed: number;
	paidRoundsUsed: number;
	now: number;
}) {
	const rule = getRevisionAddonRule(input.addOn);
	const freeRoundsRemaining = Math.max(0, rule.freeRounds - input.freeRoundsUsed);
	const paidRoundsRemaining = Math.max(0, MAX_PAID_REVISION_ROUNDS - input.paidRoundsUsed);

	if (input.deliveredAt === undefined) {
		return {
			freeRoundsRemaining,
			paidRoundsRemaining,
			state: { kind: "not_delivered", statusLabel: "Not delivered yet" } satisfies EditRevisionState
		};
	}

	const windowEndsAt = input.revisionWindowEndsAt ?? null;

	if (windowEndsAt === null) {
		return {
			freeRoundsRemaining,
			paidRoundsRemaining,
			state: {
				kind: "closed",
				badge: "Closed",
				windowEndsAt: null,
				closedReason: "pre_rollout",
				statusLabel: "Closed"
			} satisfies EditRevisionState
		};
	}

	if (input.now > windowEndsAt) {
		return {
			freeRoundsRemaining,
			paidRoundsRemaining,
			state: {
				kind: "closed",
				badge: "Closed",
				windowEndsAt,
				closedReason: "window_expired",
				statusLabel: "Closed"
			} satisfies EditRevisionState
		};
	}

	if (freeRoundsRemaining > 0) {
		return {
			freeRoundsRemaining,
			paidRoundsRemaining,
			state: {
				kind: "open_free",
				badge: "Free",
				windowEndsAt,
				statusLabel: `Request changes by ${formatRevisionDeadline(windowEndsAt)}`
			} satisfies EditRevisionState
		};
	}

	return {
		freeRoundsRemaining,
		paidRoundsRemaining,
		state: {
			kind: "closed",
			badge: "Closed",
			windowEndsAt,
			closedReason: "allowance_exhausted",
			statusLabel: "Closed"
		} satisfies EditRevisionState
	};
}
