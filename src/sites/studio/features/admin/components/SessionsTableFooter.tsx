type SessionsTableFooterProps = { filteredSessionsCount: number; totalSessionsCount: number };

export function SessionsTableFooter({
	filteredSessionsCount,
	totalSessionsCount
}: SessionsTableFooterProps) {
	return (
		<p className="text-sm text-muted-foreground">
			Showing {filteredSessionsCount} {filteredSessionsCount === 1 ? "session" : "sessions"} ·{" "}
			{totalSessionsCount} {totalSessionsCount === 1 ? "session" : "sessions"} loaded
		</p>
	);
}
