import { LoaderCircle } from "lucide-react";
import type { Id } from "#convex/_generated/dataModel";
import { Button } from "#/components/ui/button";

export type PreviousCustomInvoiceItem = {
	id: Id<"customInvoices">;
	invoiceNumber: string;
	description: string;
	total: string;
};

type PreviousCustomInvoicesProps = {
	downloadingInvoiceId: Id<"customInvoices"> | null;
	invoices: PreviousCustomInvoiceItem[];
	onDownload: (invoiceId: Id<"customInvoices">) => void;
};

export function PreviousCustomInvoices({
	downloadingInvoiceId,
	invoices,
	onDownload
}: PreviousCustomInvoicesProps) {
	return (
		<ul className="grid gap-2">
			{invoices.map((invoice) => {
				const isDownloading = downloadingInvoiceId === invoice.id;

				return (
					<li
						key={invoice.id}
						className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
						<div className="grid gap-1">
							<span className="font-medium">{invoice.invoiceNumber}</span>
							<span className="text-muted-foreground">
								{invoice.description} · {invoice.total}
							</span>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={isDownloading}
							onClick={() => onDownload(invoice.id)}>
							{isDownloading ? <LoaderCircle className="size-4 animate-spin" /> : null}
							{isDownloading ? "Downloading" : "Download"}
						</Button>
					</li>
				);
			})}
		</ul>
	);
}
