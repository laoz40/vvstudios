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
			className={`mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-x-6 rounded-lg border bg-card px-4 py-5 text-sm text-muted-foreground leading-0 shadow-lg ${className}`}>
			<p>
				Date: <span className="text-foreground font-medium">{dateSummary}</span>
			</p>
			<p>
				Time: <span className="text-foreground font-medium">{timeSummary}</span>
			</p>
		</div>
	);
}
