import type { Doc } from "#convex/_generated/dataModel";

export type AdminPackageStatus = Doc<"multiBookingPackages">["status"];

export type AdminPackageRow = {
	id: Doc<"multiBookingPackages">["_id"];
	customerName: string;
	customerEmail: string;
	customerPhone: string;
	notes?: string;
	packageSize: 4 | 8 | 12;
	bookedSessions: number;
	service: string;
	duration: string;
	addons: string[];
	totalDueLabel: string;
	invoiceDueAt: number;
	createdAt: number;
	status: AdminPackageStatus;
	hiddenAt?: number;
};

export type AdminPackageFilters = {
	hideCancelled: boolean;
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

		case "cancelled":
			return "Cancelled";

		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

export function isAdminPackageOverdue(
	packageRow: Pick<AdminPackageRow, "invoiceDueAt" | "status">
) {
	if (
		packageRow.status === "paid" ||
		packageRow.status === "schedule_email_failed" ||
		packageRow.status === "cancelled"
	) {
		return false;
	}

	return Date.now() > packageRow.invoiceDueAt;
}

export function hasAdminPackageEmailIssue(status: AdminPackageStatus) {
	return status === "invoice_email_failed" || status === "schedule_email_failed";
}

export function mapMultiBookingPackageToAdminRow(
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
		notes: multiBookingPackage.notes,
		packageSize: multiBookingPackage.packageSize,
		bookedSessions,
		service: multiBookingPackage.service,
		duration: multiBookingPackage.duration,
		addons: multiBookingPackage.addons,
		totalDueLabel: formatPackageAmount(multiBookingPackage.totalDueAmount),
		invoiceDueAt: multiBookingPackage.invoiceDueAt,
		createdAt: multiBookingPackage.createdAt,
		status: multiBookingPackage.status,
		hiddenAt: multiBookingPackage.hiddenAt
	};
}

function formatPackageAmount(amount: number) {
	return new Intl.NumberFormat("en-AU", { currency: "AUD", style: "currency" }).format(
		amount / 100
	);
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

		if (filters.hideCancelled && packageRow.status === "cancelled") {
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
