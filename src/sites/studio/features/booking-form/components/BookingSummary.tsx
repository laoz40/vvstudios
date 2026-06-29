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
	formatBookingPrice,
	getBookingAddonQuantity,
	getBookingTotal,
	isMultiBookingSize
} from "#studio/features/booking-form/lib/booking-pricing";
import { useBookingFormContext } from "#studio/features/booking-form/lib/booking-form-context";
import { formatBookingDateDots, formatBookingTimeRange } from "#studio/lib/bookingdatetime";

function formatQuantityLabel(quantity: number, label: string) {
	return `${quantity} x ${label}`;
}

export function BookingSummary() {
	const formApi = useBookingFormContext();
	const values = useSelector(formApi.store, (state) => state.values);
	const isMultiBooking = values.bookingMode === "multi";
	const durationCost = values.duration ? DURATION_PRICES[values.duration] : 0;
	const total = getBookingTotal(values);
	const multiBookingAmounts =
		isMultiBooking && isMultiBookingSize(values.packageSize)
			? calculateMultiBookingAmounts({ ...values, packageSize: values.packageSize })
			: null;
	const isWaitingForMultiBookingPackage = isMultiBooking && !multiBookingAmounts;
	const sessionQuantity = multiBookingAmounts?.packageSize ?? 1;
	const durationLineTotal = durationCost * sessionQuantity;
	const bookingLabel = [values.service, values.duration].filter(Boolean).join(" ");
	const dateLabel = isMultiBooking ? "" : formatBookingDateDots(values.date);
	const timeRangeLabel =
		!isMultiBooking && values.time && values.duration
			? formatBookingTimeRange(values.time, values.duration)
			: "";
	const timeDateLabel = [timeRangeLabel, dateLabel].filter(Boolean).join(" ");
	const showBookingLine = bookingLabel || timeDateLabel;
	return (
		<Accordion
			type="single"
			collapsible>
			<AccordionItem value="booking-summary">
				<AccordionTrigger className="py-3 text-sm justify-start gap-1">
					<span className="text-base font-semibold">BOOKING SUMMARY</span>
				</AccordionTrigger>
				<AccordionContent className="pb-3 text-sm leading-normal">
					<div className="space-y-2">
						{showBookingLine && !isWaitingForMultiBookingPackage ? (
							<div className="flex items-start justify-between gap-4">
								<p className="text-muted-foreground">
									{formatQuantityLabel(sessionQuantity, bookingLabel || "Session")}
									{timeDateLabel ? ` [${timeDateLabel}]` : ""}
								</p>
								<p>{formatBookingPrice(durationLineTotal)}</p>
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
									<p>{formatBookingPrice(lineTotal)}</p>
								</div>
							);
						})}
						{multiBookingAmounts ? (
							<>
								<div className="flex items-center justify-between border-t border-border pt-2">
									<p>Package subtotal</p>
									<p>{formatBookingPrice(multiBookingAmounts.packageSubtotalAmount)}</p>
								</div>
								<div className="flex items-center justify-between text-primary">
									<p>{multiBookingAmounts.discountPercent}% package discount</p>
									<p>-{formatBookingPrice(multiBookingAmounts.discountAmount)}</p>
								</div>
								<div className="flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground">
									<p>Total due</p>
									<p>{formatBookingPrice(multiBookingAmounts.totalDueAmount)}</p>
								</div>
								<p className="pt-1 text-sm italic leading-snug text-muted-foreground">
									You can schedule session dates after payment.
								</p>
							</>
						) : isWaitingForMultiBookingPackage ? (
							<p className="border-t border-border pt-2 text-sm italic leading-snug text-muted-foreground">
								Select a package size to see your package total.
							</p>
						) : (
							<>
								<div className="flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground">
									<p>Total</p>
									<p>{formatBookingPrice(total)}</p>
								</div>
								<p className="pt-1 text-sm italic leading-snug text-muted-foreground">
									Only $50 booking deposit required to secure your time slot, which gets deducted
									from your total.
								</p>
							</>
						)}
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
