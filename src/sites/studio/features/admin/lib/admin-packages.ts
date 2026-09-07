import { Check, ClockAlert, DollarSign, MailWarning, type LucideIcon } from "lucide-react";
import type { Doc } from "#convex/_generated/dataModel";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";

export type AdminPackageStatus =
	| "pending_payment"
	| "paid"
	| "invoice_email_failed"
	| "schedule_email_failed";

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
	totalDueLabel: string;
	totalDueAmount: number;
	adjustment: {
		id: Doc<"packageAdjustments">["_id"];
		amountLabel: string;
		invoiceDueAt: number;
		invoiceEmailStatus: "pending" | "sent" | "failed";
		paymentStatus: "unpaid" | "paid";
	} | null;
	isPaid: boolean;
	areSessionsComplete: boolean;
	invoiceDueAt: number;
	expiresAt?: number;
	createdAt: number;
	status: AdminPackageStatus;
	invoiceNumber: string;
	hiddenAt?: number;
};

export type AdminPackageDashboardDate =
	| { kind: "adjustment_due"; timestamp: number }
	| { kind: "package_expiry"; timestamp: number }
	| { kind: "payment_due"; timestamp: number }
	| { kind: "missing_package_expiry" };

export type AdminPackageSort = { column: "created" | "customer"; isDescending: boolean };

export type AdminPackagePendingAction =
	| "adjustmentDownload"
	| "adjustmentEmail"
	| "adjustmentPayment"
	| "archive"
	| "download"
	| "invoice"
	| "payment"
	| "scheduleEmail"
	| null;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const PAYMENT_REMINDER_DAYS_BEFORE_DUE = 2;
const PACKAGE_EXPIRY_REMINDER_DAYS_PER_REMAINING_SESSION = 7;

export type AdminPackageFilters = {
	showArchived: boolean;
	showOverdue: boolean;
	showPaid: boolean;
	showUpcoming: boolean;
	searchQuery: string;
};

export function getAdminPackageStatusLabel(status: AdminPackageStatus) {
	switch (status) {
		case "pending_payment":
			return "Pending";

		case "invoice_email_failed":
			return "Invoice email failed";

		case "paid":
			return "Paid";

		case "schedule_email_failed":
			return "Scheduling link failed";

		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

export type AdminPackageStatusDisplay = { className: string; icon: LucideIcon; label: string };

export function getAdminPackageStatusDisplay(
	packageRow: Pick<
		AdminPackageRow,
		"adjustment" | "expiresAt" | "invoiceDueAt" | "isPaid" | "status"
	>
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

		case "invoice_email_failed":
			return {
				className: "size-5 text-destructive",
				icon: MailWarning,
				label: "Invoice email failed"
			};

		case "schedule_email_failed":
			return {
				className: "size-5 text-destructive",
				icon: MailWarning,
				label: "Scheduling link failed"
			};

		default: {
			const _exhaustive: never = packageRow.status;
			return _exhaustive;
		}
	}
}

export function isAdminPackageOverdue(
	packageRow: Pick<AdminPackageRow, "invoiceDueAt" | "status"> & {
		adjustment: Pick<
			NonNullable<AdminPackageRow["adjustment"]>,
			"invoiceDueAt" | "paymentStatus"
		> | null;
	}
) {
	if (packageRow.adjustment?.paymentStatus === "unpaid") {
		return Date.now() > packageRow.adjustment.invoiceDueAt;
	}

	if (packageRow.status === "paid" || packageRow.status === "schedule_email_failed") {
		return false;
	}

	return Date.now() > packageRow.invoiceDueAt;
}

export function isAdminPackageExpired(packageRow: Pick<AdminPackageRow, "expiresAt" | "isPaid">) {
	return (
		packageRow.isPaid && packageRow.expiresAt !== undefined && Date.now() > packageRow.expiresAt
	);
}

export function isAdminPackageAdjustmentPaymentEligible(
	adjustment: NonNullable<AdminPackageRow["adjustment"]>
) {
	return adjustment.invoiceEmailStatus === "sent" || Date.now() > adjustment.invoiceDueAt;
}

type AdminPackageRowDimmingInput = Pick<
	AdminPackageRow,
	"areSessionsComplete" | "expiresAt" | "isPaid"
>;

export function isAdminPackageRowDimmed(packageRow: AdminPackageRowDimmingInput) {
	return isAdminPackageExpired(packageRow) || (packageRow.isPaid && packageRow.areSessionsComplete);
}

export function isAdminPackagePaymentDueClose(
	packageRow: Pick<AdminPackageRow, "adjustment" | "invoiceDueAt" | "isPaid">
) {
	const dueAt = packageRow.adjustment?.invoiceDueAt ?? packageRow.invoiceDueAt;
	const isPaymentOutstanding = packageRow.adjustment
		? packageRow.adjustment.paymentStatus === "unpaid"
		: !packageRow.isPaid;
	const millisecondsUntilDue = dueAt - Date.now();

	return (
		isPaymentOutstanding &&
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

export function isAdminPackageUpcoming(
	packageRow: Pick<AdminPackageRow, "adjustment" | "expiresAt" | "invoiceDueAt" | "isPaid">
) {
	if (packageRow.adjustment) {
		return Date.now() <= packageRow.adjustment.invoiceDueAt;
	}

	if (!packageRow.isPaid) {
		return Date.now() <= packageRow.invoiceDueAt;
	}

	return packageRow.expiresAt !== undefined && Date.now() <= packageRow.expiresAt;
}

export function getAdminPackageDashboardDate(
	packageRow: Pick<AdminPackageRow, "adjustment" | "expiresAt" | "invoiceDueAt" | "isPaid">
): AdminPackageDashboardDate {
	if (packageRow.adjustment) {
		return { kind: "adjustment_due", timestamp: packageRow.adjustment.invoiceDueAt };
	}

	if (!packageRow.isPaid) {
		return { kind: "payment_due", timestamp: packageRow.invoiceDueAt };
	}

	if (packageRow.expiresAt === undefined) {
		return { kind: "missing_package_expiry" };
	}

	return { kind: "package_expiry", timestamp: packageRow.expiresAt };
}

export function sortAdminPackages(rows: AdminPackageRow[], sort: AdminPackageSort) {
	return rows.toSorted((firstPackage, secondPackage) => {
		if (sort.column === "customer") {
			return comparePackageNames(firstPackage, secondPackage, sort.isDescending);
		}

		const createdComparison = firstPackage.createdAt - secondPackage.createdAt;

		if (createdComparison === 0) {
			return firstPackage.customerName.localeCompare(secondPackage.customerName);
		}

		return sort.isDescending ? -createdComparison : createdComparison;
	});
}

function comparePackageNames(
	firstPackage: AdminPackageRow,
	secondPackage: AdminPackageRow,
	isDescending: boolean
) {
	const nameComparison = firstPackage.customerName.localeCompare(secondPackage.customerName);
	return isDescending ? -nameComparison : nameComparison;
}

export function getPackageArchiveActionLabel(
	packageRow: Pick<AdminPackageRow, "hiddenAt">,
	pendingAction: AdminPackagePendingAction
) {
	if (pendingAction === "archive") {
		return "Updating archive...";
	}

	if (packageRow.hiddenAt === undefined) {
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
		totalDueLabel: formatPackageAmount(packageRecord.totalDueAmount),
		totalDueAmount: packageRecord.totalDueAmount,
		adjustment: packageRecord.adjustment
			? {
					id: packageRecord.adjustment._id,
					amountLabel: formatPackageAmount(packageRecord.adjustment.totalAmount),
					invoiceDueAt: packageRecord.adjustment.invoiceDueAt,
					invoiceEmailStatus: packageRecord.adjustment.invoiceEmailStatus,
					paymentStatus: packageRecord.adjustment.paymentStatus
				}
			: null,
		isPaid: packageRecord.status === "paid" || packageRecord.status === "schedule_email_failed",
		areSessionsComplete: packageRecord.areSessionsComplete,
		invoiceDueAt: packageRecord.invoiceDueAt,
		expiresAt: packageRecord.expiresAt,
		createdAt: packageRecord.createdAt,
		status: packageRecord.status,
		invoiceNumber: formatBookingInvoiceNumber(packageRecord._id, packageRecord.createdAt),
		hiddenAt: packageRecord.hiddenAt
	};
}

function formatPackageAmount(amount: number) {
	return new Intl.NumberFormat("en-AU", {
		currency: "AUD",
		maximumFractionDigits: 2,
		style: "currency"
	}).format(amount);
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
		packageRow.totalDueLabel,
		getAdminPackageStatusLabel(packageRow.status)
	]
		.join(" ")
		.toLowerCase();

	return searchableText.includes(normalizedSearchQuery);
}

export function filterAdminPackages(rows: AdminPackageRow[], filters: AdminPackageFilters) {
	return rows.filter((packageRow) => {
		if (!filters.showArchived && packageRow.hiddenAt !== undefined) {
			return false;
		}

		if (filters.showPaid && packageRow.status !== "paid") {
			return false;
		}

		if (filters.showOverdue && !isAdminPackageOverdue(packageRow)) {
			return false;
		}

		if (filters.showUpcoming && !isAdminPackageUpcoming(packageRow)) {
			return false;
		}

		return packageMatchesSearch(packageRow, filters.searchQuery);
	});
}
