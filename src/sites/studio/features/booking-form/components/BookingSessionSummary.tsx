interface BookingSessionSummaryProps {
	dateSummary: string;
	className?: string;
	timeSummary: string;
}

export function BookingSessionSummary({
	className = "",
	dateSummary,
	timeSummary
}: BookingSessionSummaryProps) {
	return (
		<div
			aria-live="polite"
			className={`mx-auto w-fit max-w-full rounded-lg border bg-surface-subtle px-4 py-3 text-center text-sm leading-tight text-muted-foreground shadow-lg ${className}`}>
			<p>
				Selected <span className="font-medium text-foreground">{dateSummary}</span> at{" "}
				<span className="font-medium text-foreground">{timeSummary}</span>
			</p>
		</div>
	);
}
