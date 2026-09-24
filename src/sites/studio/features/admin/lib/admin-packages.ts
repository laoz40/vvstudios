import { Check, ClockAlert, DollarSign, MailWarning, type LucideIcon } from "lucide-react";
import { exhaustiveCheck } from "#/lib/result";
import type { Doc } from "#convex/_generated/dataModel";
import { isPackageArchived } from "#convex/lib/archiveState";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { formatAudAmount } from "#studio/features/admin/lib/remaining-balance";

export type AdminPackageStatus = Doc<"packages">["status"];

export type AdminPackageRecord = Doc<"packages"> & {
	bookedSessions?: number;
	areSessionsComplete: boolean;
	adjustment?: {
		_id: Doc<"packageAdjustments">["_id"];
		totalAmount: number;
		invoiceDueAt: number;
		invoiceEmailStatus: "pending" | "sent" | "failed";
		paymentStatus: "unpaid" | "paid";
	} | null;
	customStripeInvoicesSummary?: { paymentStatus: "paid" | "unpaid"; totalAmount: number } | null;
};

export type AdminPackageRow = {
	id: Doc<"packages">["_id"];
	customerName: string;
	customerEmail: string;
	customerPhone: string;
	accountName: string;
	abn?: string;
	instagramHandle?: string;
	notes?: string;
	packageSize: 4 | 8 | 12;
	bookedSessions: number;
	duration: string;
	addons: BookingAddon[];
	clipsPackageQuantity?: string;
	completeEditQuantity?: string;
	essentialEditQuantity?: string;
	handcraftedClipsQuantity?: string;
	totalDueAmount: number;
	adjustment: {
		id: Doc<"packageAdjustments">["_id"];
		totalAmount: number;
		invoiceDueAt: number;
		invoiceEmailStatus: "pending" | "sent" | "failed";
		paymentStatus: "unpaid" | "paid";
	} | null;
	customStripeInvoices: { totalAmount: number; paymentStatus: "paid" | "unpaid" } | null;
	isPaid: boolean;
	areSessionsComplete: boolean;
	expiresAt?: number;
	createdAt: number;
	status: AdminPackageStatus;
	invoiceNumber: string;
	stripeCustomerId?: string;
	stripePaymentIntentId?: string;
	archived: boolean;
};

export type AdminPackageDashboardDate =
	| { kind: "adjustment_due"; timestamp: number }
	| { kind: "package_expiry"; timestamp: number }
	| { kind: "missing_package_expiry" };

export type AdminPackageSort = { isDescending: boolean };

export type PackageListSortDirection = "asc" | "desc";

export type PackageListQuerySort = { sortDirection: PackageListSortDirection };

export function toPackageListQuerySort(sort: AdminPackageSort): PackageListQuerySort {
	return { sortDirection: sort.isDescending ? "desc" : "asc" };
}

export type AdminPackagePendingAction =
	| "adjustmentEmail"
	| "archive"
	| "packageEmail"
	| "receiptDownload"
	| null;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const PAYMENT_REMINDER_DAYS_BEFORE_DUE = 2;

const PACKAGE_EXPIRY_REMINDER_DAYS_PER_REMAINING_SESSION = 7;

export type AdminPackagesView = "inbox" | "all";

export type AdminPackageSearchFilters = { searchQuery: string };

function getAdminPackageStatusLabel(status: AdminPackageStatus) {
	switch (status) {
		case "pending_payment":
			return "Pending";

		case "paid":
			return "Paid";

		case "schedule_email_failed":
			return "Receipt and scheduling email failed";

		case "abandoned":
			return "Abandoned";

		case "expired":
			return "Expired";
		default:
			return exhaustiveCheck(status);
	}
}

export type AdminPackageStatusDisplay = { className: string; icon: LucideIcon; label: string };

export function getAdminPackageStatusDisplay(
	packageRow: Pick<AdminPackageRow, "adjustment" | "expiresAt" | "isPaid" | "status">
): AdminPackageStatusDisplay {
	if (packageRow.adjustment?.invoiceEmailStatus === "failed") {
		return {
			className: "size-5 text-destructive",
			icon: MailWarning,
			label: "Adjustment invoice failed"
		};
	}

	if (isAdminPackageOverdue(packageRow)) {
		return { className: "size-5 text-destructive", icon: ClockAlert, label: "Overdue" };
	}

	if (packageRow.adjustment?.paymentStatus === "unpaid") {
		return { className: "size-5 text-primary", icon: DollarSign, label: "Adjustment pending" };
	}

	if (isAdminPackageExpired(packageRow)) {
		return { className: "size-5 text-destructive", icon: ClockAlert, label: "Expired" };
	}

	switch (packageRow.status) {
		case "pending_payment":
			return { className: "size-5 text-primary", icon: DollarSign, label: "Pending" };

		case "paid":
			return { className: "size-5 text-green", icon: Check, label: "Paid" };

		case "schedule_email_failed":
			return {
				className: "size-5 text-destructive",
				icon: MailWarning,
				label: "Receipt and scheduling email failed"
			};

		case "abandoned":
			return { className: "size-5 text-muted-foreground", icon: ClockAlert, label: "Abandoned" };

		case "expired":
			return { className: "size-5 text-destructive", icon: ClockAlert, label: "Expired" };
		default:
			return exhaustiveCheck(packageRow.status);
	}
}

function isAdminPackageOverdue(packageRow: Pick<AdminPackageRow, "adjustment">) {
	return (
		packageRow.adjustment?.paymentStatus === "unpaid" &&
		Date.now() > packageRow.adjustment.invoiceDueAt
	);
}

function isAdminPackageExpired(packageRow: Pick<AdminPackageRow, "expiresAt" | "isPaid">) {
	return (
		packageRow.isPaid && packageRow.expiresAt !== undefined && Date.now() > packageRow.expiresAt
	);
}

type AdminPackageRowDimmingInput = Pick<
	AdminPackageRow,
	"areSessionsComplete" | "expiresAt" | "isPaid"
>;

export function isAdminPackageRowDimmed(packageRow: AdminPackageRowDimmingInput) {
	return isAdminPackageExpired(packageRow) || (packageRow.isPaid && packageRow.areSessionsComplete);
}

export function isAdminPackagePaymentDueClose(packageRow: Pick<AdminPackageRow, "adjustment">) {
	const dueAt = packageRow.adjustment?.invoiceDueAt;

	if (dueAt === undefined || packageRow.adjustment?.paymentStatus !== "unpaid") {
		return false;
	}

	const millisecondsUntilDue = dueAt - Date.now();

	return (
		millisecondsUntilDue >= 0 &&
		millisecondsUntilDue <= PAYMENT_REMINDER_DAYS_BEFORE_DUE * MILLISECONDS_PER_DAY
	);
}

export function isAdminPackageExpiryClose(
	packageRow: Pick<AdminPackageRow, "bookedSessions" | "expiresAt" | "isPaid" | "packageSize">
) {
	if (!packageRow.isPaid || packageRow.expiresAt === undefined) {
		return false;
	}

	const remainingSessions = packageRow.packageSize - packageRow.bookedSessions;
	const millisecondsUntilExpiry = packageRow.expiresAt - Date.now();

	return (
		remainingSessions > 0 &&
		millisecondsUntilExpiry >= 0 &&
		millisecondsUntilExpiry <=
			remainingSessions * PACKAGE_EXPIRY_REMINDER_DAYS_PER_REMAINING_SESSION * MILLISECONDS_PER_DAY
	);
}

export function getAdminPackageDashboardDate(
	packageRow: Pick<AdminPackageRow, "adjustment" | "expiresAt" | "isPaid">
): AdminPackageDashboardDate {
	if (packageRow.adjustment) {
		return { kind: "adjustment_due", timestamp: packageRow.adjustment.invoiceDueAt };
	}

	if (!packageRow.isPaid || packageRow.expiresAt === undefined) {
		return { kind: "missing_package_expiry" };
	}

	return { kind: "package_expiry", timestamp: packageRow.expiresAt };
}

export function getPackageArchiveActionLabel(
	packageRow: Pick<AdminPackageRow, "archived">,
	pendingAction: AdminPackagePendingAction
) {
	if (pendingAction === "archive") {
		return "Updating archive...";
	}

	if (!packageRow.archived) {
		return "Archive";
	}

	return "Unarchive";
}

export function mapPackageToAdminRow(packageRecord: AdminPackageRecord): AdminPackageRow {
	const bookedSessions = packageRecord.bookedSessions ?? 0;

	return {
		id: packageRecord._id,
		customerName: packageRecord.name,
		customerEmail: packageRecord.email,
		customerPhone: packageRecord.phone,
		accountName: packageRecord.accountName,
		abn: packageRecord.abn,
		instagramHandle: packageRecord.instagramHandle,
		notes: packageRecord.notes,
		packageSize: packageRecord.packageSize,
		bookedSessions,
		duration: packageRecord.duration,
		addons: packageRecord.addons,
		clipsPackageQuantity: packageRecord.clipsPackageQuantity,
		completeEditQuantity: packageRecord.completeEditQuantity,
		essentialEditQuantity: packageRecord.essentialEditQuantity,
		handcraftedClipsQuantity: packageRecord.handcraftedClipsQuantity,
		totalDueAmount: packageRecord.totalDueAmount,
		adjustment: packageRecord.adjustment
			? {
					id: packageRecord.adjustment._id,
					totalAmount: packageRecord.adjustment.totalAmount,
					invoiceDueAt: packageRecord.adjustment.invoiceDueAt,
					invoiceEmailStatus: packageRecord.adjustment.invoiceEmailStatus,
					paymentStatus: packageRecord.adjustment.paymentStatus
				}
			: null,
		customStripeInvoices: packageRecord.customStripeInvoicesSummary
			? {
					totalAmount: packageRecord.customStripeInvoicesSummary.totalAmount,
					paymentStatus: packageRecord.customStripeInvoicesSummary.paymentStatus
				}
			: null,
		isPaid: packageRecord.status === "paid" || packageRecord.status === "schedule_email_failed",
		areSessionsComplete: packageRecord.areSessionsComplete,
		expiresAt: packageRecord.expiresAt,
		createdAt: packageRecord.createdAt,
		status: packageRecord.status,
		invoiceNumber: formatBookingInvoiceNumber(packageRecord._id, packageRecord.createdAt),
		stripeCustomerId: packageRecord.stripeCustomerId,
		stripePaymentIntentId: packageRecord.stripePaymentIntentId,
		archived: isPackageArchived(packageRecord)
	};
}

function packageMatchesSearch(packageRow: AdminPackageRow, searchQuery: string) {
	const normalizedSearchQuery = searchQuery.trim().toLowerCase();

	if (normalizedSearchQuery.length === 0) {
		return true;
	}

	const searchableText = [
		packageRow.customerName,
		packageRow.customerEmail,
		packageRow.customerPhone,
		packageRow.accountName,
		packageRow.abn,
		packageRow.instagramHandle,
		packageRow.invoiceNumber,
		`${packageRow.packageSize} sessions`,
		`${packageRow.bookedSessions} booked`,
		packageRow.duration,
		packageRow.addons.join(" "),
		formatAudAmount(packageRow.totalDueAmount),
		getAdminPackageStatusLabel(packageRow.status)
	]
		.join(" ")
		.toLowerCase();

	return searchableText.includes(normalizedSearchQuery);
}

export function filterAdminPackages(rows: AdminPackageRow[], filters: AdminPackageSearchFilters) {
	return rows.filter((packageRow) => packageMatchesSearch(packageRow, filters.searchQuery));
}
