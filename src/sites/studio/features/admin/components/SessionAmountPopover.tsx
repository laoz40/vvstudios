import { useId, useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger
} from "#/components/ui/popover";
import { Separator } from "#/components/ui/separator";
import { cn } from "#/lib/utils";
import { useAdminPrivacyMode } from "#studio/features/admin/components/AdminPrivacyMode";
import { copyText } from "#studio/features/admin/components/AdminDashboardTableUtils";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import {
	formatAudAmount,
	getAudAmountRowShowCents
} from "#studio/features/admin/lib/remaining-balance";
import {
	formatStripeInvoiceAmount,
	formatStripeInvoiceKindLabel,
	getStripeInvoiceAmountClassName
} from "#studio/features/admin/lib/stripe-invoice-billing";

type InvoiceState =
	| { kind: "loading" }
	| { kind: "error" }
	| {
			kind: "loaded";
			invoices: readonly Pick<
				Doc<"stripeInvoices">,
				"stripeInvoiceId" | "kind" | "totalAmount" | "paymentStatus"
			>[];
	  };

const loadingInvoiceState: InvoiceState = { kind: "loading" };

function getSessionInvoiceState(
	summary: SessionRecord["stripeInvoicesSummary"],
	result:
		| FunctionReturnType<typeof api.stripe.invoiceRecords.listStripeInvoicesForBooking>
		| undefined
): InvoiceState {
	if (!summary && result === undefined) return { kind: "loaded", invoices: [] };

	if (result === undefined) return loadingInvoiceState;

	if (result[0] !== null) return { kind: "error" };

	return { kind: "loaded", invoices: result[1] };
}

type SessionAmountDetailsProps = {
	checkoutAmount: number | null;
	checkoutPaymentId?: string;
	estimatedPrice: number | null;
	paidRemainingBalanceAmount: number;
	stripeInvoicesSummary: SessionRecord["stripeInvoicesSummary"];
	showCents: boolean;
	invoiceState?: InvoiceState;
};

function StripePaymentAmount({
	paymentId,
	label = "Stripe payment ID",
	children
}: {
	paymentId?: string;
	label?: string;
	children: ReactNode;
}) {
	if (!paymentId) return <span>{children}</span>;

	return (
		<button
			type="button"
			className="cursor-pointer rounded-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
			aria-label={`Copy ${label}`}
			onClick={() => void copyText(paymentId, label, `${label} copied`)}>
			{children}
		</button>
	);
}

function SessionInvoiceAmounts({ invoiceState }: { invoiceState: InvoiceState }) {
	if (invoiceState.kind === "loading") {
		return (
			<p
				role="status"
				className="text-xs text-muted-foreground">
				Loading invoices...
			</p>
		);
	}

	if (invoiceState.kind === "error") {
		return (
			<p
				role="alert"
				className="text-xs text-destructive">
				Unable to load invoice details.
			</p>
		);
	}

	if (invoiceState.invoices.length === 0) {
		return <p className="text-xs text-muted-foreground">No invoices.</p>;
	}

	return (
		<ul className="flex flex-col gap-3">
			{invoiceState.invoices.map((invoice) => (
				<li
					key={invoice.stripeInvoiceId}
					className="flex justify-between gap-3">
					<p>
						<StripePaymentAmount
							paymentId={invoice.stripeInvoiceId}
							label="Stripe invoice ID">
							{formatStripeInvoiceKindLabel(invoice.kind)}
						</StripePaymentAmount>
					</p>
					<div className={getStripeInvoiceAmountClassName(invoice.paymentStatus)}>
						<p
							className="text-right tabular-nums"
							aria-label={`${formatStripeInvoiceAmount(invoice)}, ${invoice.paymentStatus}`}>
							<StripePaymentAmount
								paymentId={invoice.stripeInvoiceId}
								label="Stripe invoice ID">
								{formatStripeInvoiceAmount(invoice)}
							</StripePaymentAmount>
						</p>
					</div>
				</li>
			))}
		</ul>
	);
}

export function SessionAmountDetails({
	checkoutAmount,
	checkoutPaymentId,
	estimatedPrice,
	paidRemainingBalanceAmount,
	stripeInvoicesSummary,
	showCents,
	invoiceState = loadingInvoiceState
}: SessionAmountDetailsProps) {
	const bookingAmount = checkoutAmount ?? estimatedPrice;

	const invoiceAmount =
		invoiceState.kind === "loaded"
			? invoiceState.invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)
			: (stripeInvoicesSummary?.totalAmount ?? 0);

	const total =
		bookingAmount === null ? null : bookingAmount + paidRemainingBalanceAmount + invoiceAmount;

	const formatAmount = (amount: number | null) =>
		amount === null
			? "Unavailable"
			: formatAudAmount(amount, {
					showCents: showCents || getAudAmountRowShowCents([invoiceAmount])
				});

	return (
		<div className="flex flex-col gap-3 text-sm">
			<dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
				<dt>
					<StripePaymentAmount paymentId={checkoutPaymentId}>
						{estimatedPrice === null ? "Checkout total" : "Estimated booking price"}
					</StripePaymentAmount>
				</dt>
				<dd className={cn("text-right tabular-nums", bookingAmount !== null && "text-green")}>
					<StripePaymentAmount paymentId={checkoutPaymentId}>
						{formatAmount(bookingAmount)}
					</StripePaymentAmount>
				</dd>
				{paidRemainingBalanceAmount !== 0 ? (
					<>
						<dt className="text-muted-foreground">Paid manual balance</dt>
						<dd className="text-right tabular-nums">{formatAmount(paidRemainingBalanceAmount)}</dd>
					</>
				) : null}
			</dl>
			<SessionInvoiceAmounts invoiceState={invoiceState} />
			<Separator />
			<dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
				<dt>Invoices total</dt>
				<dd className="text-right tabular-nums">{formatAmount(invoiceAmount)}</dd>
				<dt className="font-medium">Total</dt>
				<dd className="text-right font-medium tabular-nums">{formatAmount(total)}</dd>
			</dl>
			{estimatedPrice !== null ? (
				<p className="text-xs text-muted-foreground">
					This legacy booking&apos;s price is estimated using current rates. Its original payment
					has not been verified.
				</p>
			) : null}
		</div>
	);
}

export function SessionAmountPopover({
	rowId,
	bookingId,
	receiptAmount,
	showBookingAmount,
	...details
}: Omit<SessionAmountDetailsProps, "showCents" | "invoiceState"> & {
	rowId: string;
	bookingId: Id<"bookings">;
	receiptAmount: number | null;
	showBookingAmount: boolean;
}) {
	const [open, setOpen] = useState(false);
	const titleId = useId();
	const { isPrivacyModeEnabled, isRowRevealed, toggleRowPrivacy } = useAdminPrivacyMode();

	const isBlurred = isPrivacyModeEnabled && !isRowRevealed(rowId);

	const invoicesResult = useQuery(
		api.stripe.invoiceRecords.listStripeInvoicesForBooking,
		open && !isBlurred ? { bookingId } : "skip"
	);

	const invoiceState = getSessionInvoiceState(details.stripeInvoicesSummary, invoicesResult);

	const bookingAmount = receiptAmount ?? details.estimatedPrice;
	const invoiceAmount = details.stripeInvoicesSummary?.totalAmount ?? null;

	const showCents = getAudAmountRowShowCents(
		[
			bookingAmount,
			details.checkoutAmount,
			details.paidRemainingBalanceAmount,
			invoiceAmount
		].filter((amount): amount is number => amount !== null)
	);

	return (
		<Popover
			open={open && !isBlurred}
			onOpenChange={(nextOpen) => {
				if (!isBlurred) setOpen(nextOpen);
			}}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={isBlurred ? "Reveal session amounts" : "View session amount breakdown"}
					className="ml-auto flex cursor-pointer flex-col items-end gap-1 rounded-sm text-right underline-offset-4 select-text hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
					onClick={() => {
						if (isBlurred) toggleRowPrivacy(rowId);
					}}>
					{isBlurred ? (
						<span className="text-muted-foreground blur-sm select-none">$•••</span>
					) : (
						<>
							{showBookingAmount ? (
								<span className={bookingAmount === null ? "text-muted-foreground" : "text-green"}>
									{bookingAmount === null ? "-" : formatAudAmount(bookingAmount, { showCents })}
								</span>
							) : null}
							{details.stripeInvoicesSummary ? (
								<span
									className={getStripeInvoiceAmountClassName(
										details.stripeInvoicesSummary.paymentStatus
									)}>
									{formatAudAmount(details.stripeInvoicesSummary.totalAmount, { showCents })}
								</span>
							) : null}
						</>
					)}
				</button>
			</PopoverTrigger>
			{!isBlurred ? (
				<PopoverContent
					align="end"
					className="max-h-96 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto"
					aria-labelledby={titleId}>
					<PopoverHeader className="mb-3">
						<PopoverTitle id={titleId}>Price breakdown</PopoverTitle>
					</PopoverHeader>
					<SessionAmountDetails
						{...details}
						showCents={showCents}
						invoiceState={invoiceState}
					/>
				</PopoverContent>
			) : null}
		</Popover>
	);
}
