import type { Doc } from "#convex/_generated/dataModel";

export type AdminPackageStatus =
	| "pending_payment"
	| "paid"
	| "invoice_email_failed"
	| "schedule_email_failed";

type AdminPackageRecord = Doc<"multiBookingPackages"> & { bookedSessions?: number };

export type AdminPackageRow = {
	id: Doc<"multiBookingPackages">["_id"];
	customerName: string;
	customerEmail: string;
	customerPhone: string;
	accountName: string;
	abn?: string;
	instagramHandle?: string;
	notes?: string;
	packageSize: 4 | 8 | 12;
	bookedSessions: number;
	service: string;
	duration: string;
	addons: string[];
	clipsPackageQuantity?: string;
	essentialEditQuantity?: string;
	totalDueLabel: string;
	totalDueAmount: number;
	isPaid: boolean;
	invoiceDueAt: number;
	expiresAt?: number;
	createdAt: number;
	status: AdminPackageStatus;
	invoiceNumber?: string;
	hiddenAt?: number;
};

export type AdminPackageDashboardDate =
	| { kind: "package_expiry"; timestamp: number }
	| { kind: "payment_due"; timestamp: number }
	| { kind: "missing_package_expiry" };

export type AdminPackagePendingAction =
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
			return "Pending payment";

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

export function isAdminPackageOverdue(
	packageRow: Pick<AdminPackageRow, "invoiceDueAt" | "status">
) {
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

export function isAdminPackagePaymentDueClose(
	packageRow: Pick<AdminPackageRow, "invoiceDueAt" | "isPaid">
) {
	const millisecondsUntilDue = packageRow.invoiceDueAt - Date.now();

	return (
		!packageRow.isPaid &&
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
	packageRow: Pick<AdminPackageRow, "expiresAt" | "invoiceDueAt" | "isPaid">
) {
	if (!packageRow.isPaid) {
		return Date.now() <= packageRow.invoiceDueAt;
	}

	return packageRow.expiresAt !== undefined && Date.now() <= packageRow.expiresAt;
}

export function getAdminPackageDashboardDate(
	packageRow: Pick<AdminPackageRow, "expiresAt" | "invoiceDueAt" | "isPaid">
): AdminPackageDashboardDate {
	if (!packageRow.isPaid) {
		return { kind: "payment_due", timestamp: packageRow.invoiceDueAt };
	}

	if (packageRow.expiresAt === undefined) {
		return { kind: "missing_package_expiry" };
	}

	return { kind: "package_expiry", timestamp: packageRow.expiresAt };
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

export function mapPackageToAdminRow(multiBookingPackage: AdminPackageRecord): AdminPackageRow {
	const bookedSessions = multiBookingPackage.bookedSessions ?? 0;

	return {
		id: multiBookingPackage._id,
		customerName: multiBookingPackage.name,
		customerEmail: multiBookingPackage.email,
		customerPhone: multiBookingPackage.phone,
		accountName: multiBookingPackage.accountName,
		abn: multiBookingPackage.abn,
		instagramHandle: multiBookingPackage.instagramHandle,
		notes: multiBookingPackage.notes,
		packageSize: multiBookingPackage.packageSize,
		bookedSessions,
		service: multiBookingPackage.service,
		duration: multiBookingPackage.duration,
		addons: multiBookingPackage.addons,
		clipsPackageQuantity: multiBookingPackage.clipsPackageQuantity,
		essentialEditQuantity: multiBookingPackage.essentialEditQuantity,
		totalDueLabel: formatPackageAmount(multiBookingPackage.totalDueAmount),
		totalDueAmount: multiBookingPackage.totalDueAmount,
		isPaid:
			multiBookingPackage.status === "paid" ||
			multiBookingPackage.status === "schedule_email_failed",
		invoiceDueAt: multiBookingPackage.invoiceDueAt,
		expiresAt: multiBookingPackage.expiresAt,
		createdAt: multiBookingPackage.createdAt,
		status: multiBookingPackage.status,
		invoiceNumber: multiBookingPackage.invoiceNumber,
		hiddenAt: multiBookingPackage.hiddenAt
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
		packageRow.service,
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
