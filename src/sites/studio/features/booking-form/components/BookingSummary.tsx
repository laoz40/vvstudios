import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from "#/components/ui/accordion";
import {
	ADDON_PRICES,
	DURATION_PRICES,
	formatBookingPrice,
	getBookingTotal,
	getEditingAddonQuantity
} from "#studio/features/booking-form/lib/booking-pricing";
import { type BookingFormValues } from "#studio/features/booking-form/lib/form-shared";
import { formatBookingDateDots, formatBookingTimeRange } from "#studio/lib/bookingdatetime";

export interface BookingSummaryProps {
	values: Pick<
		BookingFormValues,
		| "addons"
		| "clipsPackageQuantity"
		| "date"
		| "duration"
		| "essentialEditQuantity"
		| "service"
		| "time"
	>;
}

export function BookingSummary({ values }: BookingSummaryProps) {
	const durationCost = values.duration ? DURATION_PRICES[values.duration] : 0;
	const total = getBookingTotal(values);
	const bookingLabel = [values.service, values.duration].filter(Boolean).join(" ");
	const dateLabel = formatBookingDateDots(values.date);
	const timeRangeLabel =
		values.time && values.duration ? formatBookingTimeRange(values.time, values.duration) : "";
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
						{showBookingLine ? (
							<div className="flex items-start justify-between">
								<p className="text-muted-foreground">
									{bookingLabel}
									{timeDateLabel ? ` [${timeDateLabel}]` : ""}
								</p>
								<p>{formatBookingPrice(durationCost)}</p>
							</div>
						) : null}
						{values.addons.map((addon) => {
							const quantity = getEditingAddonQuantity(addon, values);
							const lineTotal = ADDON_PRICES[addon] * quantity;

							return (
								<div
									key={addon}
									className="flex items-start justify-between">
									<p>{addon}</p>
									<p>{formatBookingPrice(lineTotal)}</p>
								</div>
							);
						})}
						<div className="flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground">
							<p>Total</p>
							<p>{formatBookingPrice(total)}</p>
						</div>
						<p className="pt-1 text-sm italic leading-snug text-muted-foreground">
							Only $50 booking deposit required to secure your time slot, which gets deducted from
							your total.
						</p>
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}
