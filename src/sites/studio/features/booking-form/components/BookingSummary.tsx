import { useState } from "react";
import { useSelector } from "@tanstack/react-store";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from "#/components/ui/accordion";
import {
	ADDON_PRICES,
	DURATION_PRICES,
	calculateMultiBookingAmounts,
	formatBookingPriceWithCents,
	getBookingAddonQuantity,
	getBookingTotal,
	isMultiBookingSize
} from "#studio/features/booking-form/lib/booking-pricing";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import { sectionHeadingClassName } from "#studio/features/booking-form/lib/booking-form-styles";

function formatQuantityLabel(quantity: number, label: string) {
	return `${quantity} x ${label}`;
}

export function BookingSummary() {
	const [openSummaryItem, setOpenSummaryItem] = useState<string | undefined>();
	const formApi = useBookingFormContext();
	const values = useSelector(formApi.store, (state) => state.values);
	const isMultiBooking = values.bookingMode === "multi";
	const durationCost = values.duration ? DURATION_PRICES[values.duration] : 0;
	const total = getBookingTotal(values);
	const multiBookingAmounts =
		isMultiBooking && isMultiBookingSize(values.packageSize)
			? calculateMultiBookingAmounts({ ...values, packageSize: values.packageSize })
			: null;
	const isWaitingForPackage = isMultiBooking && !multiBookingAmounts;
	const sessionQuantity = multiBookingAmounts?.packageSize ?? 1;
	const durationLineTotal = durationCost * sessionQuantity;
	const bookingLabel = isMultiBooking
		? `${values.duration} Studio Session`
		: [values.service, values.duration].filter(Boolean).join(" ");
	const showBookingLine = isMultiBooking ? Boolean(values.duration) : Boolean(bookingLabel);
	return (
		<div className="space-y-2 text-sm leading-normal tabular-nums">
			<Accordion
				type="single"
				collapsible
				value={openSummaryItem}
				onValueChange={setOpenSummaryItem}>
				<AccordionItem value="booking-summary">
					<AccordionTrigger
						showArrow={false}
						className="py-3 text-sm hover:text-foreground">
						<span className="flex w-full items-center justify-between gap-4">
							<span className={sectionHeadingClassName}>BOOKING SUMMARY</span>
							<span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary">
								{openSummaryItem === "booking-summary" ? "Hide" : "Show items"}
							</span>
						</span>
					</AccordionTrigger>
					<AccordionContent className="border-b pb-3 text-sm md:text-sm">
						<div className="space-y-2">
							{showBookingLine && !isWaitingForPackage ? (
								<div className="flex items-start justify-between gap-4">
									<p className="text-muted-foreground">
										{formatQuantityLabel(sessionQuantity, bookingLabel)}
									</p>
									<p>{formatBookingPriceWithCents(durationLineTotal)}</p>
								</div>
							) : null}
							{values.addons.map((addon) => {
								const perSessionQuantity = getBookingAddonQuantity(addon, values);
								const totalQuantity = perSessionQuantity * sessionQuantity;
								const lineTotal = ADDON_PRICES[addon] * totalQuantity;

								return (
									<div
										key={addon}
										className="flex items-start justify-between gap-4">
										<p>{formatQuantityLabel(totalQuantity, addon)}</p>
										<p>{formatBookingPriceWithCents(lineTotal)}</p>
									</div>
								);
							})}
						</div>
					</AccordionContent>
				</AccordionItem>
			</Accordion>
			<div className="space-y-2 border-border pt-2">
				{multiBookingAmounts ? (
					<>
						<div className="flex items-center justify-between text-muted-foreground">
							<p>Package subtotal</p>
							<p>{formatBookingPriceWithCents(multiBookingAmounts.packageSubtotalAmount)}</p>
						</div>
						<div className="flex items-center justify-between text-primary">
							<p>{multiBookingAmounts.discountPercent}% package discount</p>
							<p>-{formatBookingPriceWithCents(multiBookingAmounts.discountAmount)}</p>
						</div>
						<div className="flex items-center justify-between border-t border-border pt-2 text-lg font-semibold text-foreground">
							<p>Total</p>
							<p>{formatBookingPriceWithCents(multiBookingAmounts.totalDueAmount)}</p>
						</div>
						<p className="pt-1 text-sm italic leading-snug text-muted-foreground">
							You can schedule session dates after payment.
						</p>
					</>
				) : isWaitingForPackage ? (
					<p className="text-sm italic leading-snug text-muted-foreground">
						Select a package size to see your package total.
					</p>
				) : (
					<>
						<div className="flex items-center justify-between text-lg font-semibold text-foreground">
							<p>Total</p>
							<p>{formatBookingPriceWithCents(total)}</p>
						</div>
						<p className="pt-1 text-sm italic leading-snug text-muted-foreground">
							Only $50 booking deposit required to secure your time slot, which gets deducted from
							your total.
						</p>
					</>
				)}
			</div>
		</div>
	);
}
