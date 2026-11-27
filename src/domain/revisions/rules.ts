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

const MAX_REVISION_ROWS = 50;

const MAX_REVISION_NOTE_LENGTH = 1000;

const MAX_REVISION_CLIP_NUMBER_LENGTH = 40;

export interface RevisionFeedbackRowInput {
	timestamp: string;
	note: string;
	clipNumber?: string;
}

export interface RevisionFeedbackRowFieldErrors {
	timestamp?: string;
	note?: string;
	clipNumber?: string;
}

const SINGLE_TIMESTAMP_PATTERN = /^(?:(\d{1,2}):([0-5]\d):([0-5]\d)|(\d{1,3}):([0-5]\d))$/;

function parseSingleTimestampSeconds(value: string): number | null {
	const match = SINGLE_TIMESTAMP_PATTERN.exec(value);

	if (match === null) {
		return null;
	}

	if (match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
		return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
	}

	if (match[4] !== undefined && match[5] !== undefined) {
		return Number(match[4]) * 60 + Number(match[5]);
	}

	return null;
}

function isValidRevisionTimestamp(raw: string): boolean {
	const trimmed = raw.trim();

	if (trimmed.length === 0) {
		return false;
	}

	const rangeParts = trimmed.split(/\s*[-–]\s*/);

	if (rangeParts.length === 1) {
		return parseSingleTimestampSeconds(trimmed) !== null;
	}

	if (rangeParts.length === 2 && rangeParts[0] !== undefined && rangeParts[1] !== undefined) {
		const start = parseSingleTimestampSeconds(rangeParts[0]);
		const end = parseSingleTimestampSeconds(rangeParts[1]);

		return start !== null && end !== null && end >= start;
	}

	return false;
}

function validateSingleRevisionRow(row: RevisionFeedbackRowInput, requiresClipNumber: boolean) {
	const errors: RevisionFeedbackRowFieldErrors = {};
	const timestamp = row.timestamp.trim();
	const note = row.note.trim();
	const clipNumber = row.clipNumber?.trim() ?? "";

	if (!isValidRevisionTimestamp(timestamp)) {
		errors.timestamp = "Use MM:SS, H:MM:SS, or a range like 01:23-01:45.";
	}

	if (note.length === 0) {
		errors.note = "Describe the change needed.";
	} else if (note.length > MAX_REVISION_NOTE_LENGTH) {
		errors.note = `Keep each note under ${MAX_REVISION_NOTE_LENGTH} characters.`;
	}

	if (requiresClipNumber) {
		if (clipNumber.length === 0) {
			errors.clipNumber = "Enter a clip number.";
		} else if (clipNumber.length > MAX_REVISION_CLIP_NUMBER_LENGTH) {
			errors.clipNumber = `Keep clip numbers under ${MAX_REVISION_CLIP_NUMBER_LENGTH} characters.`;
		}
	}

	const hasError =
		errors.timestamp !== undefined || errors.note !== undefined || errors.clipNumber !== undefined;

	return {
		errors,
		hasError,
		sanitized: requiresClipNumber ? { timestamp, note, clipNumber } : { timestamp, note }
	};
}

export function validateRevisionFeedbackRows(
	rows: ReadonlyArray<RevisionFeedbackRowInput>,
	requiresClipNumber: boolean
):
	| { ok: true; rows: RevisionFeedbackRowInput[] }
	| { ok: false; formError?: string; rowErrors: RevisionFeedbackRowFieldErrors[] } {
	if (rows.length === 0) {
		return { ok: false, formError: "Add at least one timestamped change.", rowErrors: [] };
	}

	if (rows.length > MAX_REVISION_ROWS) {
		return {
			ok: false,
			formError: `You can include up to ${MAX_REVISION_ROWS} notes per revision request.`,
			rowErrors: []
		};
	}

	const checked = rows.map((row) => validateSingleRevisionRow(row, requiresClipNumber));

	if (checked.some((item) => item.hasError)) {
		return { ok: false, rowErrors: checked.map((item) => item.errors) };
	}

	return { ok: true, rows: checked.map((item) => item.sanitized) };
}

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

const revisionShortDateFormatter = new Intl.DateTimeFormat("en-AU", {
	timeZone: REVISION_TIME_ZONE,
	weekday: "short",
	day: "numeric",
	month: "short"
});

export function formatRevisionDeadline(windowEndsAt: number) {
	return revisionDeadlineFormatter.format(windowEndsAt);
}

export function formatRevisionShortDate(timestamp: number) {
	return revisionShortDateFormatter.format(timestamp);
}

type EditRevisionClosedReason = "pre_rollout" | "window_expired" | "allowance_exhausted";

type EditRevisionState =
	| { kind: "not_delivered"; statusLabel: "Editing in progress" }
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
			state: {
				kind: "not_delivered",
				statusLabel: "Editing in progress"
			} satisfies EditRevisionState
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

export function withFeedbackRowKeys<T extends RevisionFeedbackRowInput>(
	rows: ReadonlyArray<T>,
	prefix = ""
) {
	const counts = new Map<string, number>();

	return rows.map((row) => {
		const baseKey = `${prefix}:${row.clipNumber ?? ""}:${row.timestamp}:${row.note}`;
		const occurrence = (counts.get(baseKey) ?? 0) + 1;
		counts.set(baseKey, occurrence);

		return { key: `${baseKey}#${occurrence}`, row };
	});
}
