import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

type SessionsTableFooterProps = {
	canLoadMoreSessions: boolean;
	filteredSessionsCount: number;
	isLoadingMoreSessions: boolean;
	onLoadMoreSessions: () => void;
	onNextPage: () => void;
	onPreviousPage: () => void;
	pageCount: number;
	pageIndex: number;
	totalSessionsCount: number;
};

export function SessionsTableFooter({
	canLoadMoreSessions,
	filteredSessionsCount,
	isLoadingMoreSessions,
	onLoadMoreSessions,
	onNextPage,
	onPreviousPage,
	pageCount,
	pageIndex,
	totalSessionsCount
}: SessionsTableFooterProps) {
	return (
		<div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-3">
			<div className="flex flex-wrap items-center gap-3 md:gap-6">
				<div
					className={cn(
						"flex w-full items-center justify-between gap-3",
						"md:w-auto md:justify-start md:gap-6"
					)}>
					<p className="text-sm text-muted-foreground">
						Showing {filteredSessionsCount} {filteredSessionsCount === 1 ? "session" : "sessions"} ·{" "}
						{totalSessionsCount} {totalSessionsCount === 1 ? "session" : "sessions"} loaded
					</p>
				</div>
				{canLoadMoreSessions || isLoadingMoreSessions ? (
					<Button
						variant="outline"
						size="sm"
						onClick={onLoadMoreSessions}
						disabled={isLoadingMoreSessions}>
						{isLoadingMoreSessions ? "Loading..." : "Load more"}
					</Button>
				) : null}
			</div>
			<div className="flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
				<p className="text-sm text-muted-foreground">
					Page {pageIndex + 1} of {pageCount}
				</p>
				<Button
					variant="outline"
					size="sm"
					onClick={onPreviousPage}
					disabled={pageIndex === 0}>
					Previous
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={onNextPage}
					disabled={pageIndex >= pageCount - 1}>
					Next
				</Button>
			</div>
		</div>
	);
}
