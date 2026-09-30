/**
 * Admin search backfill receipt helpers.
 */
import { describe, expect, test } from "vitest";
import type { Doc } from "#convex/_generated/dataModel";
import { receiptNumberForPaidPackage } from "#convex/lib/adminSearchBackfill";
import { testPackageId } from "#convex/lib/tests/testIds";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";

describe("receiptNumberForPaidPackage", () => {
	test("uses stored receipt when present", () => {
		const packageRecord = createPackageFixture({ receiptNumber: "VV-STORED-001", status: "paid" });

		expect(receiptNumberForPaidPackage(packageRecord)).toBe("VV-STORED-001");
	});

	test("derives receipt from paidAt when missing", () => {
		const packageId = testPackageId("jd7abc123def456789012345");
		const paidAt = 1_704_067_200_000;

		const packageRecord = createPackageFixture({ _id: packageId, paidAt, status: "paid" });

		expect(receiptNumberForPaidPackage(packageRecord)).toBe(
			formatBookingInvoiceNumber(packageId, paidAt)
		);
	});
});

function createPackageFixture(
	overrides: Partial<Doc<"packages">> & Pick<Doc<"packages">, "status">
): Doc<"packages"> {
	const createdAt = 1_704_067_200_000;

	return {
		_id: testPackageId("jd7abc123def456789012345"),
		_creationTime: createdAt,
		name: "Package",
		phone: "0400000000",
		accountName: "Account",
		email: "pkg@example.com",
		duration: "1 hour",
		addons: [],
		packageSize: 4,
		singleSessionAmount: 100,
		packageSubtotalAmount: 400,
		discountPercent: 0,
		discountAmount: 0,
		totalDueAmount: 400,
		createdAt,
		archived: false,
		...overrides
	};
}
