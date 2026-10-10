import type { EditInvoiceQuote } from "#convex/stripe/lib/editInvoiceBilling";
import {
	formatAudAmount,
	getAudAmountRowShowCents
} from "#studio/features/admin/lib/remaining-balance";

export type EditPaymentSummaryData = Pick<EditInvoiceQuote, "paidAmount">;

export function EditPaymentSummary({ summary }: { summary?: EditPaymentSummaryData | null }) {
	if (summary === undefined)
		return (
			<p role="status">
				Paid: <span className="text-muted-foreground">Loading…</span>
			</p>
		);

	if (summary === null) return null;

	return (
		<p>
			Paid:{" "}
			<span className="font-medium">
				{summary.paidAmount === null ? "Unavailable" : formatAudAmount(summary.paidAmount)}
			</span>
		</p>
	);
}

export function EditPriceSummary({
	currentTotal,
	newTotal,
	summary
}: {
	currentTotal: number;
	newTotal: number;
	summary?: EditPaymentSummaryData | null;
}) {
	const difference = newTotal - currentTotal;
	const showCents = getAudAmountRowShowCents([currentTotal, newTotal, difference]);

	return (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t pt-3 text-sm tabular-nums">
			<p>
				{difference === 0 ? "Current total:" : "New total:"}{" "}
				<span className={difference === 0 ? "font-medium" : "text-muted-foreground"}>
					{formatAudAmount(currentTotal, { showCents })}
				</span>
				{difference !== 0 ? (
					<>
						{" → "}
						<span className="font-medium">{formatAudAmount(newTotal, { showCents })}</span>{" "}
						<span className="text-muted-foreground">
							({difference > 0 ? "+" : "-"}
							{formatAudAmount(Math.abs(difference), { showCents })})
						</span>
					</>
				) : null}
			</p>
			<EditPaymentSummary summary={summary} />
		</div>
	);
}
