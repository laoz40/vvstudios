import { LoaderCircle } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import { cn } from "#/lib/utils";

export type PreviousCustomInvoiceItem = {
	id: string;
	invoiceNumber: string;
	description: string;
	total: string;
};

type PreviousCustomInvoicesProps = {
	downloadingInvoiceId: string | null;
	invoices?: PreviousCustomInvoiceItem[];
	onDownload: (invoiceId: string) => void;
};

export function PreviousCustomInvoices({
	downloadingInvoiceId,
	invoices,
	onDownload
}: PreviousCustomInvoicesProps) {
	if (!invoices || invoices.length === 0) {
		return null;
	}

	return (
		<section className="grid gap-3">
			<Label>Previous custom invoices</Label>
			<div className="rounded-lg border bg-muted/40 p-3 text-sm">
				<ul className="grid gap-3">
					{invoices.map((invoice) => {
						const isDownloading = downloadingInvoiceId === invoice.id;

						return (
							<li
								key={invoice.id}
								className={cn(
									"flex flex-col gap-2",
									"sm:flex-row sm:items-center sm:justify-between"
								)}>
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
									{isDownloading ? "Downloading..." : "Download"}
								</Button>
							</li>
						);
					})}
				</ul>
			</div>
		</section>
	);
}
