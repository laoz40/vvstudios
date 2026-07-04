import type { Doc } from "#convex/_generated/dataModel";

export type AdminPackageStatus =
	| "pending_payment"
	| "paid"
	| "invoice_email_failed"
	| "schedule_email_failed";

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
	isPaid: boolean;
	invoiceDueAt: number;
	expiresAt?: number;
	createdAt: number;
	status: AdminPackageStatus;
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

export type AdminPackageFilters = {
	hideEmailIssues: boolean;
	hideHidden: boolean;
	hideOverdue: boolean;
	hidePaid: boolean;
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

export function hasAdminPackageEmailIssue(status: AdminPackageStatus) {
	return status === "invoice_email_failed" || status === "schedule_email_failed";
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

export function getPackagePaymentActionLabel(
	packageRow: Pick<AdminPackageRow, "isPaid">,
	pendingAction: AdminPackagePendingAction
) {
	if (pendingAction === "payment") {
		return "Updating payment...";
	}

	if (packageRow.isPaid) {
		return "Mark unpaid";
	}

	return "Mark paid";
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

export function mapPackageToAdminRow(
	multiBookingPackage: Doc<"multiBookingPackages">
): AdminPackageRow {
	const bookedSessions = multiBookingPackage.sessions.filter(
		(session) => session.bookingId !== undefined && session.cancelledAt === undefined
	).length;

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
		isPaid:
			multiBookingPackage.status === "paid" ||
			multiBookingPackage.status === "schedule_email_failed",
		invoiceDueAt: multiBookingPackage.invoiceDueAt,
		expiresAt: multiBookingPackage.expiresAt,
		createdAt: multiBookingPackage.createdAt,
		status: multiBookingPackage.status,
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
		packageRow.notes,
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
		if (filters.hideHidden && packageRow.hiddenAt !== undefined) {
			return false;
		}

		if (filters.hidePaid && packageRow.status === "paid") {
			return false;
		}

		if (filters.hideOverdue && isAdminPackageOverdue(packageRow)) {
			return false;
		}

		if (filters.hideEmailIssues && hasAdminPackageEmailIssue(packageRow.status)) {
			return false;
		}

		return packageMatchesSearch(packageRow, filters.searchQuery);
	});
}
