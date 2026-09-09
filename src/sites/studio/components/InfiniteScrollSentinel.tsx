import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";

type InfiniteScrollSentinelProps = {
	canLoadMore: boolean;
	isLoadingMore: boolean;
	onLoadMore: () => void;
};

export function InfiniteScrollSentinel({
	canLoadMore,
	isLoadingMore,
	onLoadMore
}: InfiniteScrollSentinelProps) {
	const sentinelRef = useRef<HTMLDivElement>(null);

	// Load the next page when the sentinel scrolls into view.
	useEffect(() => {
		const element = sentinelRef.current;

		if (!element || !canLoadMore || isLoadingMore) {
			return undefined;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					onLoadMore();
				}
			},
			{ rootMargin: "200px" }
		);

		observer.observe(element);
		return () => observer.disconnect();
	}, [canLoadMore, isLoadingMore, onLoadMore]);

	if (!canLoadMore && !isLoadingMore) {
		return null;
	}

	return (
		<div
			ref={sentinelRef}
			className="flex justify-center py-4">
			{isLoadingMore ? (
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<LoaderCircle
						className="size-4 animate-spin"
						aria-hidden
					/>
					Loading
				</div>
			) : (
				<div
					className="h-4"
					aria-hidden
				/>
			)}
		</div>
	);
}
