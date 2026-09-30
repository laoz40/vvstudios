import { LoaderCircle } from "lucide-react";
import { Button } from "#/components/ui/button";
import type { AdminSearchNarrowField } from "#studio/features/admin/lib/admin-search-narrow";
import { formatAdminSearchNarrowQuery } from "#studio/features/admin/lib/admin-search-narrow";

type AdminSearchRefineBannerProps = {
	narrowFields: AdminSearchNarrowField[];
	onConfirmLoadAll: () => void;
	onNarrowSearch: (searchQuery: string) => void;
	searchQuery: string;
};

export function AdminSearchRefineBanner({
	narrowFields,
	onConfirmLoadAll,
	onNarrowSearch,
	searchQuery
}: AdminSearchRefineBannerProps) {
	return (
		<div
			className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 pb-6 md:p-4"
			role="region"
			aria-label="Search refinement">
			<div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-2 rounded-lg border bg-surface-subtle p-4 shadow-lg">
				<p className="text-sm text-foreground">
					This search has many matches. Before you continue, narrow it down by:
				</p>
				<div className="flex flex-wrap items-center gap-x-1 gap-y-1">
					{narrowFields.map((field) => (
						<Button
							key={field.prefix}
							className="h-auto px-2 py-1 text-sm text-foreground"
							size="sm"
							type="button"
							variant="ghost"
							onClick={() =>
								onNarrowSearch(formatAdminSearchNarrowQuery(field.prefix, searchQuery))
							}>
							{field.label}
						</Button>
					))}
					<Button
						className="h-auto px-2 py-1 text-sm text-destructive hover:bg-transparent hover:text-destructive"
						size="sm"
						type="button"
						variant="ghost"
						onClick={onConfirmLoadAll}>
						Load everything
					</Button>
				</div>
			</div>
		</div>
	);
}

type AdminSearchBatchLoadingControlsProps = {
	isPaused: boolean;
	loadedCount: number;
	onContinue: () => void;
	onStop: () => void;
	showStop: boolean;
};

export function AdminSearchBatchLoadingControls({
	isPaused,
	loadedCount,
	onContinue,
	onStop,
	showStop
}: AdminSearchBatchLoadingControlsProps) {
	if (isPaused) {
		return (
			<div className="flex shrink-0 items-center gap-1">
				<span className="text-sm whitespace-nowrap text-muted-foreground">
					{loadedCount} loaded
				</span>
				<Button
					className="h-auto px-2 py-1 text-sm"
					size="sm"
					type="button"
					variant="ghost"
					onClick={onContinue}>
					Continue
				</Button>
			</div>
		);
	}

	return (
		<div
			className="flex shrink-0 items-center gap-1"
			role="status">
			<LoaderCircle
				className="size-4 animate-spin text-muted-foreground"
				aria-hidden
			/>
			<span className="text-sm whitespace-nowrap text-muted-foreground">Loading</span>
			{showStop ? (
				<Button
					className="h-auto px-2 py-1 text-sm"
					size="sm"
					type="button"
					variant="ghost"
					onClick={onStop}>
					Stop
				</Button>
			) : null}
		</div>
	);
}
