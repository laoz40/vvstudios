import { useEffect, useState } from "react";
import type { PaginationStatus } from "convex/react";

type UseAdminTableSearchPaginationArgs = {
	hasActiveSearch: boolean;
	isLoadingFirstPage: boolean;
	isLoadingMore: boolean;
	loadMore: (pageSize: number) => void;
	pageSize: number;
	resultCount: number;
	searchKey: string;
	status: PaginationStatus;
};

type UseAdminTableSearchPaginationResult = {
	continueSearchBatchLoading: () => void;
	confirmLoadAllMatches: () => void;
	isSearchBatchLoading: boolean;
	isSearchBatchPaused: boolean;
	loadedMatchCount: number;
	showRefineSearchBanner: boolean;
	showSearchLoadingControls: boolean;
	showSearchLoadingStop: boolean;
	stopSearchBatchLoading: () => void;
	useScrollSentinelPagination: boolean;
};

type AdminSearchPaginationFlags = {
	isSearchBatchLoading: boolean;
	isSearchBatchPaused: boolean;
	shouldAutoBatchLoad: boolean;
	showRefineSearchBanner: boolean;
	showSearchLoadingControls: boolean;
	showSearchLoadingStop: boolean;
};

function deriveAdminSearchPaginationFlags(args: {
	batchLoadingStopped: boolean;
	canLoadMore: boolean;
	hasActiveSearch: boolean;
	heavySearchGate: boolean;
	isLoadingFirstPage: boolean;
	isLoadingMore: boolean;
	loadAllConfirmed: boolean;
}): AdminSearchPaginationFlags {
	const showRefineSearchBanner = deriveShowRefineSearchBanner(args);
	const shouldAutoBatchLoad = deriveShouldAutoBatchLoad(args);

	const isSearchBatchLoading = deriveIsSearchBatchLoading({
		...args,
		shouldAutoBatchLoad,
		showRefineSearchBanner
	});

	const isSearchBatchPaused = deriveIsSearchBatchPaused(args);

	const isSearchQueryLoading =
		args.hasActiveSearch && (args.isLoadingFirstPage || args.isLoadingMore);

	return {
		isSearchBatchLoading,
		isSearchBatchPaused,
		shouldAutoBatchLoad,
		showRefineSearchBanner,
		showSearchLoadingControls: isSearchQueryLoading || isSearchBatchLoading || isSearchBatchPaused,
		showSearchLoadingStop: isSearchBatchLoading
	};
}

function deriveShowRefineSearchBanner(args: {
	hasActiveSearch: boolean;
	heavySearchGate: boolean;
	isLoadingFirstPage: boolean;
	loadAllConfirmed: boolean;
}) {
	return (
		args.hasActiveSearch &&
		args.heavySearchGate &&
		!args.loadAllConfirmed &&
		!args.isLoadingFirstPage
	);
}

function deriveShouldAutoBatchLoad(args: {
	batchLoadingStopped: boolean;
	hasActiveSearch: boolean;
	heavySearchGate: boolean;
	loadAllConfirmed: boolean;
}) {
	return (
		args.hasActiveSearch &&
		(!args.heavySearchGate || args.loadAllConfirmed) &&
		!args.batchLoadingStopped
	);
}

function deriveIsSearchBatchLoading(args: {
	canLoadMore: boolean;
	isLoadingMore: boolean;
	shouldAutoBatchLoad: boolean;
	showRefineSearchBanner: boolean;
}) {
	return (
		args.shouldAutoBatchLoad &&
		!args.showRefineSearchBanner &&
		(args.isLoadingMore || args.canLoadMore)
	);
}

function deriveIsSearchBatchPaused(args: {
	batchLoadingStopped: boolean;
	canLoadMore: boolean;
	hasActiveSearch: boolean;
	isLoadingFirstPage: boolean;
	loadAllConfirmed: boolean;
}) {
	return (
		args.hasActiveSearch &&
		args.batchLoadingStopped &&
		args.loadAllConfirmed &&
		args.canLoadMore &&
		!args.isLoadingFirstPage
	);
}

export function useAdminTableSearchPagination(
	args: UseAdminTableSearchPaginationArgs
): UseAdminTableSearchPaginationResult {
	const {
		hasActiveSearch,
		isLoadingFirstPage,
		isLoadingMore,
		loadMore,
		pageSize,
		resultCount,
		searchKey,
		status
	} = args;

	const [loadAllConfirmed, setLoadAllConfirmed] = useState(false);
	const [batchLoadingStopped, setBatchLoadingStopped] = useState(false);
	const [heavySearchGate, setHeavySearchGate] = useState(false);
	const [firstSearchPageReady, setFirstSearchPageReady] = useState(false);

	const canLoadMore = status === "CanLoadMore";

	// Reset search batch state when the debounced query changes.
	useEffect(() => {
		setLoadAllConfirmed(false);
		setBatchLoadingStopped(false);
		setHeavySearchGate(false);
		setFirstSearchPageReady(false);
	}, [searchKey]);

	// First search page with more list pages than one batch → show refine banner until opt-in.
	useEffect(() => {
		if (!hasActiveSearch || isLoadingFirstPage || firstSearchPageReady) {
			return;
		}

		setFirstSearchPageReady(true);

		if (canLoadMore) {
			setHeavySearchGate(true);
		}
	}, [canLoadMore, firstSearchPageReady, hasActiveSearch, isLoadingFirstPage, searchKey]);

	const {
		isSearchBatchLoading,
		isSearchBatchPaused,
		shouldAutoBatchLoad,
		showRefineSearchBanner,
		showSearchLoadingControls,
		showSearchLoadingStop
	} = deriveAdminSearchPaginationFlags({
		batchLoadingStopped,
		canLoadMore,
		hasActiveSearch,
		heavySearchGate,
		isLoadingFirstPage,
		isLoadingMore,
		loadAllConfirmed
	});

	// Fetch further search pages without scroll when allowed.
	useEffect(() => {
		if (!shouldAutoBatchLoad || !canLoadMore || isLoadingMore) {
			return;
		}

		loadMore(pageSize);
	}, [canLoadMore, isLoadingMore, loadMore, pageSize, shouldAutoBatchLoad]);

	function confirmLoadAllMatches() {
		setLoadAllConfirmed(true);
		setBatchLoadingStopped(false);
	}

	function stopSearchBatchLoading() {
		setBatchLoadingStopped(true);
	}

	function continueSearchBatchLoading() {
		setBatchLoadingStopped(false);
	}

	return {
		continueSearchBatchLoading,
		confirmLoadAllMatches,
		isSearchBatchLoading,
		isSearchBatchPaused,
		loadedMatchCount: resultCount,
		showRefineSearchBanner,
		showSearchLoadingControls,
		showSearchLoadingStop,
		stopSearchBatchLoading,
		useScrollSentinelPagination: !hasActiveSearch
	};
}
