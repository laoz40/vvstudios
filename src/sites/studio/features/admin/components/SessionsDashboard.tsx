import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { ArrowDown, ArrowUp, ListFilter, Menu } from "lucide-react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { CleanupOldPendingAndExpiredBookingsResult } from "#convex/bookings";
import type { Doc } from "#convex/_generated/dataModel";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import TrashIcon from "#/components/ui/trash-icon";
import { Button } from "#/components/ui/button";
import { Badge } from "#/components/ui/badge";
import { Checkbox } from "#/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuTrigger
} from "#/components/ui/dropdown-menu";
import { Label } from "#/components/ui/label";
import { Input } from "#/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "#/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger
} from "#/components/ui/sheet";
import { cn } from "#/lib/utils";
import { tryCatch } from "#/lib/result";
import { AdminAvailabilitySettings } from "#studio/features/admin/components/AdminAvailabilitySettings";
import { SessionActions } from "#studio/features/admin/components/SessionActions";
import {
	CopyableText,
	customerFilter,
	formatInstagramHandle
} from "#studio/features/admin/components/AdminDashboardTableUtils";
import { PackagesDashboard } from "#studio/features/admin/components/PackagesDashboard";
import {
	readStoredSessionsDashboardSorting,
	readStoredShowStaleBookings,
	readStoredShowUpcomingOnly,
	storeSessionsDashboardSorting,
	storeShowStaleBookings,
	storeShowUpcomingOnly
} from "#studio/features/admin/lib/sessions-dashboard-preferences";
import {
	formatAudAmount,
	getRemainingBalanceAmount,
	hasUnpaidRemainingBalance
} from "#studio/features/admin/lib/remaining-balance";
import {
	bookingStatusBadgeClassNameMap,
	bookingStatusBadgeVariantMap,
	bookingStatusLabelMap,
	deliverableStatusBadgeClassNameMap,
	deliverableStatusBadgeVariantMap,
	deliverableStatusLabelMap,
	getDeliverableStatus,
	hasUnsentDeliverables,
	isDeliverableSession
} from "#studio/features/admin/lib/booking-edit-status";
import { isStaleCleanupBooking } from "#studio/features/admin/lib/admin-bookings";
import { formatEditingAddonLabel } from "#studio/features/booking-form/lib/editing-addon-quantities";
import {
	formatBookingDateMedium,
	formatBookingRelativeDate,
	formatBookingTimestamp,
	formatBookingTimeLabel,
	getBookingStartTimestamp,
	isUpcomingBooking
} from "#studio/lib/bookingdatetime";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";

export type SessionsDashboardProps = {
	bookings: BookingRecord[];
	canLoadMoreBookings: boolean;
	canLoadMorePackages: boolean;
	email: string | null;
	isLoadingMoreBookings: boolean;
	isLoadingMorePackages: boolean;
	loadMoreBookings: () => void;
	loadMorePackages: () => void;
	packages: Doc<"multiBookingPackages">[];
	signOutControl: ReactNode;
};

type DashboardView = "sessions" | "packages";

function DashboardMenu({
	email,
	signOutControl
}: Pick<SessionsDashboardProps, "email" | "signOutControl">) {
	return (
		<Sheet>
			<SheetTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="md:hidden"
					aria-label="Open admin menu">
					<Menu aria-hidden />
				</Button>
			</SheetTrigger>
			<SheetContent>
				<SheetHeader>
					<SheetTitle>Admin menu</SheetTitle>
					<SheetDescription>Signed in as {email ?? "Unknown user"}.</SheetDescription>
				</SheetHeader>
				<div className="flex flex-col items-start gap-2 px-4">
					<AdminAvailabilitySettings />
					{signOutControl}
				</div>
			</SheetContent>
		</Sheet>
	);
}

export function SessionsDashboard({
	bookings,
	canLoadMoreBookings,
	canLoadMorePackages,
	email,
	isLoadingMoreBookings,
	isLoadingMorePackages,
	loadMoreBookings,
	loadMorePackages,
	packages,
	signOutControl
}: SessionsDashboardProps) {
	// Convex mutations
	const cleanupOldBookings = useMutation(api.bookings.cleanupOldPendingAndExpiredBookings);

	// Dashboard view
	const [activeView, setActiveView] = useState<DashboardView>("sessions");

	// Table setup and persisted filters
	type SessionSortId = "name" | "session" | "createdAt";
	type SessionSorting = { id: SessionSortId; desc: boolean }[];

	const [sorting, setSorting] = useState<SessionSorting>(() => {
		return readStoredSessionsDashboardSorting().filter(
			(sort): sort is SessionSorting[number] =>
				sort.id === "name" || sort.id === "session" || sort.id === "createdAt"
		);
	});
	const [searchQuery, setSearchQuery] = useState("");
	const [pageIndex, setPageIndex] = useState(0);
	const [showUpcomingOnly, setShowUpcomingOnly] = useState(() => readStoredShowUpcomingOnly());
	const [showStaleBookings, setShowStaleBookings] = useState(() => readStoredShowStaleBookings());

	// Cleanup dialog state
	const [isCleanupDialogOpen, setIsCleanupDialogOpen] = useState(false);
	const [isCleaningUp, setIsCleaningUp] = useState(false);

	// Cleanup candidates
	const staleCleanupBookings = useMemo(
		() => bookings.filter((booking) => isStaleCleanupBooking(booking)),
		[bookings]
	);

	// Persist table sorting changes.
	useEffect(() => {
		storeSessionsDashboardSorting(sorting);
	}, [sorting]);

	// Persist the upcoming-only filter.
	useEffect(() => {
		storeShowUpcomingOnly(showUpcomingOnly);
	}, [showUpcomingOnly]);

	// Persist the stale-bookings filter.
	useEffect(() => {
		storeShowStaleBookings(showStaleBookings);
	}, [showStaleBookings]);

	// Reset pagination when visible rows change.
	useEffect(() => {
		setPageIndex(0);
	}, [searchQuery, showStaleBookings, showUpcomingOnly]);

	// Visible booking rows after dashboard-level filters.
	const filteredBookings = useMemo(() => {
		return bookings.filter((booking) => {
			if (!customerFilter({ original: booking }, searchQuery)) {
				return false;
			}

			if (
				showUpcomingOnly &&
				!isUpcomingBooking(booking.date, booking.time) &&
				!hasUnsentDeliverables(booking) &&
				!hasUnpaidRemainingBalance(booking)
			) {
				return false;
			}

			if (!showStaleBookings && isStaleCleanupBooking(booking)) {
				return false;
			}

			return true;
		});
	}, [bookings, searchQuery, showStaleBookings, showUpcomingOnly]);

	const sortedBookings = useMemo(() => {
		const activeSort = sorting[0];

		if (!activeSort) {
			return filteredBookings;
		}

		return [...filteredBookings].sort((firstBooking, secondBooking) => {
			let comparison = 0;

			switch (activeSort.id) {
				case "name":
					comparison = firstBooking.name.localeCompare(secondBooking.name);
					break;

				case "session":
					comparison =
						getBookingStartTimestamp(firstBooking.date, firstBooking.time) -
						getBookingStartTimestamp(secondBooking.date, secondBooking.time);
					break;

				case "createdAt":
					comparison = firstBooking.pendingPaymentCreatedAt - secondBooking.pendingPaymentCreatedAt;
					break;

				default: {
					const _exhaustive: never = activeSort.id;
					return _exhaustive;
				}
			}

			return activeSort.desc ? -comparison : comparison;
		});
	}, [filteredBookings, sorting]);

	const pageSize = 12;
	const pageCount = Math.max(1, Math.ceil(sortedBookings.length / pageSize));
	const paginatedBookings = sortedBookings.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

	function updateSorting(id: SessionSortId) {
		setSorting((currentSorting) => {
			const currentSort = currentSorting[0];

			if (currentSort?.id === id) {
				return [{ id, desc: !currentSort.desc }];
			}

			return [{ id, desc: false }];
		});
	}

	function renderSortButton(label: string, id: SessionSortId) {
		const activeSort = sorting[0];
		const isActive = activeSort?.id === id;
		const SortIcon = activeSort?.desc ? ArrowDown : ArrowUp;

		return (
			<Button
				variant="ghost"
				className={cn(
					"px-0!",
					isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
				)}
				onClick={() => updateSorting(id)}>
				<span>{label}</span>
				<SortIcon
					data-icon="inline-end"
					className={cn(isActive ? "opacity-100" : "opacity-60")}
				/>
			</Button>
		);
	}

	// Cleanup actions
	async function handleCleanupOldBookings() {
		setIsCleaningUp(true);

		const [error, result] = await tryCatch<CleanupOldPendingAndExpiredBookingsResult>(
			cleanupOldBookings({})
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to clean up bookings.");
					break;

				case "BOOKING_CLEANUP_FAILED":
					toast.error("Unable to clean up old bookings.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while cleaning up old bookings.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsCleaningUp(false);
			return;
		}

		setIsCleanupDialogOpen(false);
		toast.success(
			result.deletedCount === 1
				? "Deleted 1 unconfirmed booking."
				: `Deleted ${result.deletedCount} unconfirmed bookings.`
		);
		setIsCleaningUp(false);
	}

	const staleCounts = useMemo(
		() =>
			staleCleanupBookings.reduce(
				(accumulator, booking) => {
					accumulator[booking.status] += 1;
					return accumulator;
				},
				{ abandoned: 0, confirmed: 0, expired: 0, email_failed: 0, failed: 0, pending_payment: 0 }
			),
		[staleCleanupBookings]
	);

	function handleDashboardViewChange(value: string) {
		if (value === "sessions" || value === "packages") {
			setActiveView(value);
		}
	}

	return (
		<main
			className={cn(
				"relative flex min-h-screen flex-col gap-5 md:gap-6",
				"bg-card",
				"p-3 pb-8 md:p-4 lg:px-6"
			)}>
			<div className="absolute top-3 right-3 md:hidden">
				<DashboardMenu
					email={email}
					signOutControl={signOutControl}
				/>
			</div>
			<section className="flex flex-col gap-4 pr-14 md:gap-5 md:pr-0">
				<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
					<Tabs
						value={activeView}
						onValueChange={handleDashboardViewChange}>
						<TabsList variant="line">
							<TabsTrigger value="sessions">Sessions</TabsTrigger>
							<TabsTrigger value="packages">Packages</TabsTrigger>
						</TabsList>
					</Tabs>

					<div className="hidden md:block">
						<div className="flex flex-wrap items-center gap-2">
							<AdminAvailabilitySettings />
							<span title={`Signed in as ${email ?? "Unknown user"}`}>{signOutControl}</span>
						</div>
					</div>
				</div>
			</section>

			{activeView === "sessions" ? (
				<section className="flex flex-col gap-4">
					<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
						<div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
							<Input
								placeholder="Search sessions..."
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								className="w-full md:w-sm"
							/>
							<div className="flex items-center justify-end gap-3 md:contents">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											type="button"
											variant="outline"
											size="sm"
											className="md:hidden">
											<ListFilter aria-hidden />
											Filters
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuGroup>
											<DropdownMenuCheckboxItem
												checked={showStaleBookings}
												onCheckedChange={(checked) => setShowStaleBookings(checked === true)}
												onSelect={(event) => event.preventDefault()}>
												Show unconfirmed sessions
											</DropdownMenuCheckboxItem>
											<DropdownMenuCheckboxItem
												checked={showUpcomingOnly}
												onCheckedChange={(checked) => setShowUpcomingOnly(checked === true)}
												onSelect={(event) => event.preventDefault()}>
												Show only due sessions
											</DropdownMenuCheckboxItem>
										</DropdownMenuGroup>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>
						<div className="hidden flex-col gap-3 md:flex md:flex-row md:flex-wrap md:items-center">
							<div className="flex items-center gap-2">
								<Checkbox
									id="show-stale-bookings"
									checked={showStaleBookings}
									onCheckedChange={(checked) => setShowStaleBookings(checked === true)}
								/>
								<Label
									htmlFor="show-stale-bookings"
									className="text-sm font-medium text-foreground">
									Show unconfirmed sessions
								</Label>
							</div>
							<div className="flex items-center gap-2">
								<Checkbox
									id="show-upcoming-only"
									checked={showUpcomingOnly}
									onCheckedChange={(checked) => setShowUpcomingOnly(checked === true)}
								/>
								<Label
									htmlFor="show-upcoming-only"
									className="text-sm font-medium text-foreground">
									Show only due sessions
								</Label>
							</div>
						</div>
					</div>

					<div className="overflow-x-auto border-y">
						<Table className="min-w-6xl table-fixed">
							<TableHeader>
								<TableRow>
									<TableHead className="w-36">{renderSortButton("Customer", "name")}</TableHead>
									<TableHead className="w-24 md:w-16">Status</TableHead>
									<TableHead className="w-28 md:w-16">
										{renderSortButton("Session", "session")}
									</TableHead>
									<TableHead className="w-44">Service</TableHead>
									<TableHead className="w-56 md:w-36">Contact</TableHead>
									<TableHead className="w-56">Notes</TableHead>
									<TableHead className="w-16 md:w-8">Due</TableHead>
									<TableHead className="w-24 md:w-16">Deliverables</TableHead>
									<TableHead className="w-36 md:w-20">
										{renderSortButton("Created", "createdAt")}
									</TableHead>
									<TableHead className="w-12 md:w-6" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{paginatedBookings.length > 0 ? (
									paginatedBookings.map((booking) => {
										const isPastBooking = !isUpcomingBooking(booking.date, booking.time);
										const relativeDateLabel = formatBookingRelativeDate(booking.date);
										const isRemainingBalancePaid = booking.paidRemainingBalance === true;
										const remainingBalanceLabel = formatAudAmount(
											getRemainingBalanceAmount(booking)
										);
										const showRemainingBalance =
											booking.status === "confirmed" || booking.status === "email_failed";
										const deliverableStatus = isDeliverableSession(booking)
											? getDeliverableStatus(booking)
											: null;

										return (
											<TableRow
												key={booking._id}
												className={cn(isPastBooking && "text-muted-foreground")}>
												<TableCell className={cn(isPastBooking && "opacity-70")}>
													<div className="flex flex-col gap-1 whitespace-normal">
														<p className="font-medium">
															<CopyableText
																value={booking.name}
																label="customer name">
																{booking.name}
															</CopyableText>
														</p>
														{booking.accountName || booking.abn ? (
															<p className="text-sm">
																{booking.accountName ? (
																	<CopyableText
																		value={booking.accountName}
																		label="account name">
																		{booking.accountName}
																	</CopyableText>
																) : null}
																{booking.abn ? (
																	<>
																		{booking.accountName ? " · " : ""}
																		<CopyableText
																			value={booking.abn}
																			label="ABN">
																			{booking.abn}
																		</CopyableText>
																	</>
																) : null}
															</p>
														) : null}
													</div>
												</TableCell>
												<TableCell className={cn(isPastBooking && "opacity-70")}>
													<Badge
														variant={bookingStatusBadgeVariantMap[booking.status]}
														className={bookingStatusBadgeClassNameMap[booking.status]}>
														{bookingStatusLabelMap[booking.status]}
													</Badge>
												</TableCell>
												<TableCell className={cn(isPastBooking && "opacity-70")}>
													<div
														className="flex cursor-help flex-col gap-1 whitespace-normal"
														title={relativeDateLabel}>
														<p className="font-medium">{formatBookingDateMedium(booking.date)}</p>
														<p className="text-sm">
															{formatBookingTimeLabel(booking.time)}
															{booking.duration ? ` · ${booking.duration}` : ""}
														</p>
													</div>
												</TableCell>
												<TableCell className={cn(isPastBooking && "opacity-70")}>
													<div className="flex min-w-48 flex-col gap-2 whitespace-normal">
														<p className="font-medium">{booking.service}</p>
														{booking.addons.length > 0 ? (
															<div className="flex flex-wrap gap-1">
																{booking.addons.map((addon) => (
																	<Badge
																		key={addon}
																		variant="outline">
																		{formatEditingAddonLabel(addon, booking)}
																	</Badge>
																))}
															</div>
														) : (
															<p className="text-sm text-muted-foreground">No add-ons</p>
														)}
													</div>
												</TableCell>
												<TableCell className={cn(isPastBooking && "opacity-70")}>
													<div className="flex flex-col gap-1 whitespace-normal">
														<p className="break-all font-medium">
															<CopyableText
																value={booking.email}
																label="email">
																{booking.email}
															</CopyableText>
														</p>
														<p className="text-sm">
															{booking.phone ? (
																<CopyableText
																	value={booking.phone}
																	label="phone number">
																	{booking.phone}
																</CopyableText>
															) : (
																<span>No phone provided</span>
															)}
															{booking.instagramHandle ? (
																<>
																	{" · "}
																	<CopyableText
																		value={formatInstagramHandle(booking.instagramHandle)}
																		label="Instagram handle">
																		{formatInstagramHandle(booking.instagramHandle)}
																	</CopyableText>
																</>
															) : null}
														</p>
													</div>
												</TableCell>
												<TableCell className={cn(isPastBooking && "opacity-70")}>
													<p className="whitespace-normal text-sm text-muted-foreground">
														{booking.notes?.trim() || "No notes"}
													</p>
												</TableCell>
												<TableCell className={cn(isPastBooking && "opacity-70")}>
													{showRemainingBalance ? (
														<p
															className={
																isRemainingBalancePaid ? "text-green" : "text-destructive"
															}>
															{remainingBalanceLabel}
														</p>
													) : null}
												</TableCell>
												<TableCell>
													{deliverableStatus ? (
														<Badge
															variant={deliverableStatusBadgeVariantMap[deliverableStatus]}
															className={deliverableStatusBadgeClassNameMap[deliverableStatus]}>
															{deliverableStatusLabelMap[deliverableStatus]}
														</Badge>
													) : null}
												</TableCell>
												<TableCell className={cn(isPastBooking && "opacity-70")}>
													<p className="min-w-44 font-medium whitespace-normal">
														{formatBookingTimestamp(booking.pendingPaymentCreatedAt)}
													</p>
												</TableCell>
												<TableCell>
													<SessionActions booking={booking} />
												</TableCell>
											</TableRow>
										);
									})
								) : (
									<TableRow>
										<TableCell
											colSpan={10}
											className="h-24 text-center text-muted-foreground">
											No bookings yet. L business.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>

					<div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-3">
						<div className="flex flex-wrap items-center gap-3 md:gap-6">
							<div
								className={cn(
									"flex w-full items-center justify-between gap-3",
									"md:w-auto md:justify-start md:gap-6"
								)}>
								<p className="text-sm text-muted-foreground">
									Showing {filteredBookings.length}{" "}
									{filteredBookings.length === 1 ? "session" : "sessions"} · {bookings.length}{" "}
									{bookings.length === 1 ? "session" : "sessions"} loaded
								</p>
								<AnimatedIconButton
									variant="ghost"
									size="sm"
									className="text-sm! hover:text-destructive"
									disabled={isCleaningUp || staleCleanupBookings.length === 0}
									aria-label="Clean up unconfirmed bookings"
									onClick={() => setIsCleanupDialogOpen(true)}
									iconPosition="before"
									renderIcon={(iconRef) => (
										<TrashIcon
											ref={iconRef}
											aria-hidden
										/>
									)}>
									<button type="button">
										<span className="hidden md:inline">Clean up unconfirmed bookings</span>
									</button>
								</AnimatedIconButton>
							</div>
							{canLoadMoreBookings || isLoadingMoreBookings ? (
								<Button
									variant="outline"
									size="sm"
									onClick={loadMoreBookings}
									disabled={isLoadingMoreBookings}>
									{isLoadingMoreBookings ? "Loading..." : "Load more"}
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
								onClick={() =>
									setPageIndex((currentPageIndex) => Math.max(0, currentPageIndex - 1))
								}
								disabled={pageIndex === 0}>
								Previous
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									setPageIndex((currentPageIndex) => Math.min(pageCount - 1, currentPageIndex + 1))
								}
								disabled={pageIndex >= pageCount - 1}>
								Next
							</Button>
						</div>
					</div>
				</section>
			) : (
				<PackagesDashboard
					packages={packages}
					canLoadMorePackages={canLoadMorePackages}
					isLoadingMorePackages={isLoadingMorePackages}
					loadMorePackages={loadMorePackages}
				/>
			)}

			<Dialog
				open={isCleanupDialogOpen}
				onOpenChange={setIsCleanupDialogOpen}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle>Clean up unconfirmed bookings?</DialogTitle>
						<DialogDescription>
							This will permanently delete unconfirmed booking records from the database.
						</DialogDescription>
					</DialogHeader>

					<div className="rounded-lg border bg-muted/40 p-3 text-sm">
						<p className="font-medium">{staleCleanupBookings.length} bookings will be deleted</p>
						<ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
							<li>{staleCounts.expired} expired bookings</li>
							<li>{staleCounts.abandoned} abandoned bookings</li>
							<li>{staleCounts.pending_payment} pending bookings older than 24 hours</li>
						</ul>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsCleanupDialogOpen(false)}
							disabled={isCleaningUp}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleCleanupOldBookings}
							disabled={isCleaningUp || staleCleanupBookings.length === 0}>
							{isCleaningUp ? "Deleting..." : "Delete unconfirmed bookings"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</main>
	);
}
