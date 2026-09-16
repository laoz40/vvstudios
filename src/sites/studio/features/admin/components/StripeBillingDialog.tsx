import { useState } from "react";
import { useAction } from "convex/react";
import { ExternalLink, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { exhaustiveCheck, tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import {
	CopyableText,
	copyText
} from "#studio/features/admin/components/AdminDashboardTableUtils";
import { SessionCustomerSummary } from "#studio/features/admin/components/SessionCustomerSummary";
import {
	formatStripeInvoiceAmount,
	formatStripeInvoiceBillingLinkLabel,
	formatStripeInvoiceKindLabel,
	getStripeInvoiceAmountClassName,
	getStripeInvoiceBillingLinks,
	type StripeInvoiceBillingLink
} from "#studio/features/admin/lib/stripe-invoice-billing";

type StripeBillingDialogProps = {
	customerEmail: string;
	customerName: string;
	invoices?: Doc<"stripeInvoices">[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

type LoadingBillingLink = { link: StripeInvoiceBillingLink; stripeInvoiceId: string };

function getBillingUrl(
	urls: { invoicePdf?: string; receiptUrl?: string },
	link: StripeInvoiceBillingLink
) {
	if (link === "invoicePdf") {
		return urls.invoicePdf;
	}

	return urls.receiptUrl;
}

export function StripeBillingDialog({
	customerEmail,
	customerName,
	invoices,
	open,
	onOpenChange
}: StripeBillingDialogProps) {
	const [loadingBillingLink, setLoadingBillingLink] = useState<LoadingBillingLink | null>(null);
	const getStripeInvoiceBillingUrls = useAction(api.stripeInvoicing.getStripeInvoiceBillingUrls);
	const isLoading = invoices === undefined;
	const hasInvoices = invoices !== undefined && invoices.length > 0;
	const isOpeningBillingLink = loadingBillingLink !== null;

	async function handleOpenBillingLink(
		invoice: Doc<"stripeInvoices">,
		link: StripeInvoiceBillingLink
	) {
		setLoadingBillingLink({ stripeInvoiceId: invoice.stripeInvoiceId, link });

		const [error, billingUrls] = await tryCatch(
			getStripeInvoiceBillingUrls({ stripeInvoiceId: invoice.stripeInvoiceId })
		);

		setLoadingBillingLink(null);

		if (error !== null) {
			const reason = error.reason;

			switch (reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");

					return;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to Stripe billing links.");

					return;
				case "STRIPE_INVOICE_LOOKUP_FAILED":
					toast.error("Unable to load Stripe billing links.");

					return;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while opening Stripe billing.");

					return;
				default:
					exhaustiveCheck(reason);
			}
		}

		const billingUrl = getBillingUrl(billingUrls, link);

		if (!billingUrl) {
			if (link === "receipt" && invoice.paymentStatus === "paid") {
				toast.error(
					"Receipt is no longer available. Copy the invoice ID and search for it in the Stripe dashboard."
				);
				await copyText(invoice.stripeInvoiceId, "Stripe invoice ID");

				return;
			}

			toast.error("This Stripe billing link is unavailable.");

			return;
		}

		window.open(billingUrl, "_blank", "noopener,noreferrer");
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (isOpeningBillingLink && !nextOpen) {
					return;
				}

				onOpenChange(nextOpen);
			}}>
			<DialogContent
				className="overflow-y-auto sm:max-w-lg"
				data-lenis-prevent
				onInteractOutside={(event) => {
					if (isOpeningBillingLink) {
						event.preventDefault();
					}
				}}
				onEscapeKeyDown={(event) => {
					if (isOpeningBillingLink) {
						event.preventDefault();
					}
				}}>
				<DialogClose asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute top-2 right-2"
						aria-label="Close Stripe billing dialog"
						disabled={isOpeningBillingLink}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="text-left">
					<DialogTitle>Stripe billing</DialogTitle>
				</DialogHeader>

				<SessionCustomerSummary
					bookingEmail={customerEmail}
					bookingName={customerName}
				/>

				{isLoading ? (
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<LoaderCircle className="size-4 animate-spin" />
						Loading Stripe invoices
					</div>
				) : null}

				{!isLoading && !hasInvoices ? (
					<p className="text-sm text-muted-foreground">No Stripe invoices for this record.</p>
				) : null}

				{hasInvoices ? (
					<ul className="grid gap-2">
						{invoices.map((invoice) => (
							<li
								key={invoice._id}
								className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
								<div className="flex min-w-0 flex-col gap-0.5">
									<div className="flex min-w-0 items-center gap-1 font-medium">
										<span className="truncate">{formatStripeInvoiceKindLabel(invoice.kind)}</span>
										<span className="text-muted-foreground">·</span>
										<span className={getStripeInvoiceAmountClassName(invoice.paymentStatus)}>
											{formatStripeInvoiceAmount(invoice)}
										</span>
									</div>
									<CopyableText
										value={invoice.stripeInvoiceId}
										label="Stripe invoice ID">
										<span className="truncate font-mono text-xs text-muted-foreground">
											{invoice.stripeInvoiceId}
										</span>
									</CopyableText>
								</div>
								<div className="flex shrink-0 gap-2">
									{getStripeInvoiceBillingLinks(invoice).map((link) => {
										const isLoadingLink =
											loadingBillingLink?.stripeInvoiceId === invoice.stripeInvoiceId &&
											loadingBillingLink.link === link;

										return (
											<Button
												key={link}
												type="button"
												variant="outline"
												size="sm"
												disabled={isOpeningBillingLink}
												onClick={() => {
													void handleOpenBillingLink(invoice, link);
												}}>
												{isLoadingLink ? (
													<LoaderCircle className="size-4 animate-spin" />
												) : (
													<ExternalLink className="size-4" />
												)}
												{isLoadingLink
													? "Opening billing link"
													: formatStripeInvoiceBillingLinkLabel(link)}
											</Button>
										);
									})}
								</div>
							</li>
						))}
					</ul>
				) : null}

				{hasInvoices ? (
					<p className="text-sm text-muted-foreground">
						If a link fails, copy the invoice ID and search for it in the{" "}
						<a
							href="https://dashboard.stripe.com/invoices"
							target="_blank"
							rel="noopener noreferrer"
							className="text-foreground underline underline-offset-4">
							Stripe dashboard
						</a>{" "}
						to open the invoice or receipt manually.
					</p>
				) : null}

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						disabled={isOpeningBillingLink}
						onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
