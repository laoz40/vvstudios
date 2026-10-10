import type { EditInvoiceQuote } from "#convex/stripe/lib/editInvoiceBilling";
import { formatAudAmount } from "#studio/features/admin/lib/remaining-balance";

export function EditInvoicePreview({
	quote
}: {
	quote: Pick<EditInvoiceQuote, "lineItems" | "amount">;
}) {
	return (
		<section className="grid gap-3 rounded-lg border p-3">
			<h3 className="text-sm font-bold">Stripe invoice preview</h3>
			<table className="w-full text-sm">
				<thead className="sr-only">
					<tr>
						<th scope="col">Item</th>
						<th scope="col">Amount</th>
					</tr>
				</thead>
				<tbody>
					{quote.lineItems.map((line) => (
						<tr key={line.description}>
							<td className="py-1 pr-4">{line.description}</td>
							<td className="py-1 text-right whitespace-nowrap tabular-nums">
								{formatAudAmount(line.amount)}
							</td>
						</tr>
					))}
				</tbody>
				<tfoot>
					<tr className="border-t font-semibold">
						<th
							scope="row"
							className="pt-3 text-left">
							Invoice total
						</th>
						<td className="pt-3 text-right tabular-nums">{formatAudAmount(quote.amount)}</td>
					</tr>
				</tfoot>
			</table>
		</section>
	);
}
