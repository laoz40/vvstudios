export type AdminPackageStatus =
	| "pending_payment"
	| "invoice_email_failed"
	| "paid"
	| "schedule_email_failed";

export type AdminPackageRow = {
	id: string;
	customerName: string;
	customerEmail: string;
	customerPhone: string;
	notes?: string;
	packageSize: 4 | 8 | 12;
	bookedSessions: number;
	totalDueLabel: string;
	invoiceDueAt: number;
	createdAt: number;
	status: AdminPackageStatus;
	hiddenAt?: number;
};

export type AdminPackageFilters = {
	hidePaid: boolean;
	hideOverdue: boolean;
	hideEmailIssues: boolean;
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
		packageRow.totalDueLabel,
		getAdminPackageStatusLabel(packageRow.status)
	]
		.join(" ")
		.toLowerCase();

	return searchableText.includes(normalizedSearchQuery);
}

export function filterAdminPackages(rows: AdminPackageRow[], filters: AdminPackageFilters) {
	return rows.filter((packageRow) => {
		if (packageRow.hiddenAt !== undefined) {
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
