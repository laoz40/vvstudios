export type BookingCustomerSummaryProps = {
	bookingEmail: string;
	bookingName: string;
};

export function BookingCustomerSummary({ bookingEmail, bookingName }: BookingCustomerSummaryProps) {
	return (
		<div className="rounded-lg border bg-muted/40 p-4">
			<dl className="grid gap-3 text-sm sm:grid-cols-2">
				<div className="grid gap-1">
					<dt className="text-muted-foreground">Customer</dt>
					<dd className="font-medium">{bookingName}</dd>
				</div>
				<div className="grid gap-1">
					<dt className="text-muted-foreground">Email</dt>
					<dd className="break-all font-medium">{bookingEmail}</dd>
				</div>
			</dl>
		</div>
	);
}
