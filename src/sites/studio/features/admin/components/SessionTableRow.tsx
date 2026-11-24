import { useState, type ReactNode, type MouseEvent } from "react";
import { ChevronRight, CircleAlert } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { TableCell, TableRow } from "#/components/ui/table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger
} from "#/components/ui/dropdown-menu";
import { useTextOverflow } from "#studio/hooks/useTextOverflow";
import { cn } from "#/lib/utils";
import { AdminSessionEditsTable } from "#studio/features/admin/components/AdminSessionEditsTable";
import { SessionEditsInsetRow } from "#studio/features/sessions/components/SessionEditsInsetRow";
import { AdminTableInfoPopover } from "#studio/features/admin/components/AdminTableInfoPopover";
import { SessionAmountPopover } from "#studio/features/admin/components/SessionAmountPopover";
import { SessionActions } from "#studio/features/admin/components/SessionActions";
import { StatusIcon } from "#studio/features/admin/components/StatusIcon";
import {
	AdminTableInlineFieldSeparator,
	formatInstagramHandle
} from "#studio/features/admin/components/AdminDashboardTableUtils";
import { PrivacySensitiveText } from "#studio/features/admin/components/PrivacySensitiveText";
import {
	sessionStatusIconClassNameMap,
	sessionStatusIconMap,
	sessionStatusLabelMap,
	deliverableStatusBadgeClassNameMap,
	deliverableStatusBadgeVariantMap,
	deliverableStatusLabelMap,
	getDeliverableStatus,
	getEditDeliverySummary,
	isDeliverableSession
} from "#studio/features/admin/lib/session-edit-status";
import { SessionServiceCell } from "#studio/features/sessions/components/SessionServiceCell";
import { useDeliverablesEmailAction } from "#studio/features/admin/hooks/useDeliverablesEmailAction";
import {
	formatAdminDashboardDuration,
	getPackageSessionProgressLabel,
	getLegacySessionEstimatedPrice,
	getSessionPaidBookingAmount,
	type SessionRecord
} from "#studio/features/admin/lib/admin-sessions";
import { formatAdminSearchNarrowQuery } from "#studio/features/admin/lib/admin-search-narrow";
import {
	formatShortMonthFullDate,
	formatBookingDateMedium,
	formatBookingRelativeDate,
	formatBookingTimestampTime,
	formatBookingTimeLabel,
	isUpcomingBooking
} from "#studio/lib/bookingdatetime";

const driveWorkflowAttentionMessage =
	"A Google Drive setup step failed or is incomplete. Open the session menu and select Google Drive folders to see details and retry.";

function DriveWorkflowAttentionIcon() {
	return (
		<AdminTableInfoPopover
			content={driveWorkflowAttentionMessage}
			triggerClassName="inline-flex rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
			<CircleAlert
				aria-hidden
				className="size-3.5 text-destructive"
			/>
		</AdminTableInfoPopover>
	);
}

function SessionEditorNameCell({
	editorName,
	onSearch,
	rowId,
	showDriveAlert
}: {
	editorName: string;
	onSearch: (searchQuery: string) => void;
	rowId: string;
	showDriveAlert: boolean;
}) {
	return (
		<p className="flex w-full min-w-0 justify-center text-xs">
			<span className="flex max-w-full min-w-0 items-center gap-1">
				{showDriveAlert ? (
					<span className="shrink-0">
						<DriveWorkflowAttentionIcon />
					</span>
				) : null}
				<span className="min-w-0 truncate">
					<PrivacySensitiveText
						rowId={rowId}
						value={editorName}
						label="editor name"
						className="!text-xs !underline-offset-2"
						searchPrefix="editor"
						onSearch={onSearch}>
						{editorName}
					</PrivacySensitiveText>
				</span>
			</span>
		</p>
	);
}

type SessionTableRowProps = {
	onReceiptSearch: (searchQuery: string) => void;
	session: SessionRecord;
};

function SessionCustomerCell({
	onSearch,
	rowId,
	session
}: {
	onSearch: (searchQuery: string) => void;
	rowId: string;
	session: SessionRecord;
}) {
	const accountDisplayValue =
		session.accountName.trim().length > 0 ? session.accountName : session.abn;

	return (
		<div className="flex min-w-0 flex-col gap-1 whitespace-normal">
			<p className="min-w-0 truncate font-medium">
				<PrivacySensitiveText
					rowId={rowId}
					value={session.name}
					label="customer name"
					searchPrefix="name"
					onSearch={onSearch}>
					{session.name}
				</PrivacySensitiveText>
			</p>
			{accountDisplayValue ? (
				<p className="min-w-0 truncate text-sm">
					<PrivacySensitiveText
						rowId={rowId}
						value={accountDisplayValue}
						label={session.accountName.trim().length > 0 ? "account name" : "ABN"}
						searchPrefix={session.accountName.trim().length > 0 ? "account" : "abn"}
						additionalPopoverFields={
							session.accountName.trim().length > 0 && session.abn
								? [{ fieldLabel: "ABN", value: session.abn, searchPrefix: "abn" }]
								: undefined
						}
						onSearch={onSearch}>
						{accountDisplayValue}
					</PrivacySensitiveText>
				</p>
			) : null}
		</div>
	);
}

function SessionContactCell({
	onSearch,
	rowId,
	session
}: {
	onSearch: (searchQuery: string) => void;
	rowId: string;
	session: SessionRecord;
}) {
	return (
		<div className="flex min-w-0 flex-col gap-1 whitespace-normal">
			<p className="min-w-0 truncate font-medium">
				<PrivacySensitiveText
					rowId={rowId}
					value={session.email}
					label="email"
					searchPrefix="email"
					onSearch={onSearch}>
					{session.email}
				</PrivacySensitiveText>
			</p>
			<p className="flex min-w-0 items-baseline text-sm">
				{session.phone ? (
					<span className="shrink-0 whitespace-nowrap">
						<PrivacySensitiveText
							rowId={rowId}
							value={session.phone}
							label="phone number"
							searchPrefix="phone"
							onSearch={onSearch}>
							{session.phone}
						</PrivacySensitiveText>
					</span>
				) : (
					<span>No phone provided</span>
				)}
				{session.instagramHandle ? (
					<>
						<AdminTableInlineFieldSeparator />
						<span className="min-w-0 flex-1 truncate">
							<PrivacySensitiveText
								rowId={rowId}
								value={formatInstagramHandle(session.instagramHandle)}
								label="Instagram handle"
								searchPrefix="ig"
								onSearch={onSearch}>
								{formatInstagramHandle(session.instagramHandle)}
							</PrivacySensitiveText>
						</span>
					</>
				) : null}
			</p>
		</div>
	);
}

type SessionNotesView = "client" | "editor" | "admin";

const sessionNotesViewLabelMap: Record<SessionNotesView, string> = {
	client: "Client",
	editor: "Editor",
	admin: "Admin"
};

function getDefaultSessionNotesView(isPastSession: boolean): SessionNotesView {
	if (isPastSession) {
		return "editor";
	}

	return "client";
}

function getSessionNotesForView(session: SessionRecord, notesView: SessionNotesView) {
	if (notesView === "client") {
		return session.notes?.trim();
	}

	if (notesView === "editor") {
		return session.editorNotes?.trim();
	}

	return session.adminNotes?.trim();
}

function SessionNotesCell({
	session,
	isPastSession
}: {
	session: SessionRecord;
	isPastSession: boolean;
}) {
	const [notesView, setNotesView] = useState<SessionNotesView>(() =>
		getDefaultSessionNotesView(isPastSession)
	);

	const [isCollapsed, setIsCollapsed] = useState(false);

	const [previousIsPastSession, setPreviousIsPastSession] = useState(isPastSession);

	if (previousIsPastSession !== isPastSession) {
		setPreviousIsPastSession(isPastSession);
		setNotesView(getDefaultSessionNotesView(isPastSession));
	}

	const notesLabel = sessionNotesViewLabelMap[notesView];
	const visibleNotes = getSessionNotesForView(session, notesView);
	const notesText = visibleNotes || "-";

	const { previewRef, isTruncated } = useTextOverflow();

	const notesViews: SessionNotesView[] = ["client", "editor", "admin"];

	return (
		<div
			className={cn(
				"relative w-full text-left text-sm [overflow-wrap:anywhere] whitespace-pre-wrap text-muted-foreground select-text",
				isCollapsed && isTruncated && "flex items-baseline gap-1"
			)}>
			{/* Measure without the toggle so it cannot cause its own overflow. */}
			<span
				ref={previewRef}
				aria-hidden
				className="pointer-events-none invisible absolute inset-x-0 top-0 line-clamp-1">
				<span className="font-bold">{notesLabel}:</span> {notesText}
			</span>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label={`Select notes view, currently ${notesLabel}`}
						className="inline shrink-0 cursor-pointer rounded-sm p-0 font-bold text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
						{notesLabel}:
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					<DropdownMenuRadioGroup value={notesView}>
						{notesViews.map((view) => (
							<DropdownMenuRadioItem
								key={view}
								value={view}
								onSelect={() => setNotesView(view)}>
								{sessionNotesViewLabelMap[view]}
							</DropdownMenuRadioItem>
						))}
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>{" "}
			<span className={cn(isCollapsed && isTruncated && "min-w-0 flex-1 truncate")}>
				{notesText}
			</span>
			{visibleNotes && isTruncated ? (
				<>
					{" "}
					<button
						type="button"
						aria-expanded={!isCollapsed}
						className="shrink-0 cursor-pointer rounded-sm text-foreground underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						onClick={() => setIsCollapsed(!isCollapsed)}>
						{isCollapsed ? "Show more" : "Show less"}
					</button>
				</>
			) : null}
		</div>
	);
}

function SessionAmountCell({ rowId, session }: { rowId: string; session: SessionRecord }) {
	const packageSessionProgressLabel = getPackageSessionProgressLabel(session);

	const showBookingAmount =
		!packageSessionProgressLabel &&
		(session.status === "confirmed" || session.status === "email_failed");

	if (!showBookingAmount && !session.stripeInvoicesSummary) {
		return <p className="text-muted-foreground">-</p>;
	}

	const receiptAmount = showBookingAmount ? getSessionPaidBookingAmount(session) : null;

	return (
		<SessionAmountPopover
			rowId={rowId}
			bookingId={session._id}
			showBookingAmount={showBookingAmount}
			receiptAmount={receiptAmount}
			checkoutAmount={showBookingAmount ? (session.originalPaidAmount ?? null) : null}
			checkoutPaymentId={session.stripePaymentIntentId}
			estimatedPrice={getLegacySessionEstimatedPrice(session)}
			paidRemainingBalanceAmount={
				receiptAmount !== null && session.paidRemainingBalance
					? (session.remainingBalanceAmount ?? 0)
					: 0
			}
			stripeInvoicesSummary={session.stripeInvoicesSummary}
		/>
	);
}

function PackageSessionProgress({
	label,
	onReceiptSearch,
	receiptNumber
}: {
	label: string | null;
	onReceiptSearch: (searchQuery: string) => void;
	receiptNumber: string | undefined;
}) {
	if (!label) {
		return <p>-</p>;
	}

	if (!receiptNumber) {
		return <p className="text-sm font-medium">{label}</p>;
	}

	return (
		<Button
			type="button"
			variant="link"
			className="h-auto p-0 text-sm font-medium text-foreground select-text"
			onClick={() => onReceiptSearch(formatAdminSearchNarrowQuery("receipt", receiptNumber))}>
			{label}
		</Button>
	);
}

function SessionEditsToggle({
	sessionName,
	edits,
	expanded,
	rowId,
	onToggle
}: {
	sessionName: string;
	edits: NonNullable<SessionRecord["edits"]>;
	expanded: boolean;
	rowId: string;
	onToggle: () => void;
}) {
	const summary = getEditDeliverySummary(edits);

	return (
		<button
			type="button"
			className="inline-flex cursor-pointer items-center gap-1.5 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
			aria-expanded={expanded}
			aria-controls={rowId}
			onClick={onToggle}>
			<ChevronRight
				aria-hidden
				data-expanded={expanded}
				className="size-4 transition-transform duration-200 ease-in data-[expanded=true]:rotate-90 motion-reduce:transition-none"
			/>
			<Badge className={summary.className}>{summary.label}</Badge>
			<span className="sr-only"> · Edits for {sessionName}</span>
		</button>
	);
}

function SessionDeliverableBadge({
	session,
	isDeliverable,
	onReview
}: {
	session: SessionRecord;
	isDeliverable: boolean;
	onReview: () => void;
}) {
	if (!isDeliverable) return null;

	const status = getDeliverableStatus(session);

	const displayStatus =
		status === "to_edit" && session.assignedEditorTokenIdentifier === undefined
			? "unassigned"
			: status;

	const badge = (
		<Badge
			variant={deliverableStatusBadgeVariantMap[displayStatus]}
			className={deliverableStatusBadgeClassNameMap[displayStatus]}>
			{deliverableStatusLabelMap[displayStatus]}
		</Badge>
	);

	return status === "review" ? (
		<button
			type="button"
			onClick={onReview}>
			{badge}
		</button>
	) : (
		badge
	);
}

function isEditsRowClick(event: MouseEvent<HTMLTableRowElement>) {
	const { target, currentTarget } = event;

	return (
		target instanceof Element &&
		currentTarget.contains(target) &&
		!target.closest("button, a, input, select, textarea, [role=button]") &&
		currentTarget.ownerDocument.getSelection()?.type !== "Range"
	);
}

export function SessionTableRow({ onReceiptSearch, session }: SessionTableRowProps) {
	const [editsExpanded, setEditsExpanded] = useState(false);
	const edits = session.edits?.length ? session.edits : undefined;
	const editsRowId = `admin-edits-${session._id}`;
	const isDeliverable = isDeliverableSession(session);
	const isPastSession = !isUpcomingBooking(session.date, session.time);
	const relativeDateLabel = formatBookingRelativeDate(session.date);
	const packageSessionProgressLabel = getPackageSessionProgressLabel(session);
	const packageReceiptNumber = session.receiptNumber;
	const assignedEditorDisplayName = session.assignedEditorDisplayName ?? null;
	const deliverablesEmailAction = useDeliverablesEmailAction(session);

	const pastCellClassName = isPastSession && !edits ? "opacity-70" : undefined;
	let assignedEditorContent: ReactNode = null;

	if (assignedEditorDisplayName) {
		assignedEditorContent = (
			<SessionEditorNameCell
				editorName={assignedEditorDisplayName}
				onSearch={onReceiptSearch}
				rowId={session._id}
				showDriveAlert={session.hasDriveWorkflowFailure === true}
			/>
		);
	} else if (session.hasDriveWorkflowFailure) {
		assignedEditorContent = (
			<p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
				<DriveWorkflowAttentionIcon />
				<span>Google Drive</span>
			</p>
		);
	}

	return (
		<>
			<TableRow
				data-expanded={editsExpanded}
				className={cn(
					isPastSession && !edits && "text-muted-foreground",
					edits &&
						"cursor-pointer bg-muted hover:bg-muted has-[+tr:last-child[data-session-edits]]:border-b-0 data-[expanded=true]:border-b-0"
				)}
				onClick={
					edits
						? (event) => {
								if (isEditsRowClick(event)) setEditsExpanded((expanded) => !expanded);
							}
						: undefined
				}>
				<TableCell className={cn("text-center", pastCellClassName)}>
					<div className="flex justify-center">
						<StatusIcon
							icon={sessionStatusIconMap[session.status]}
							label={sessionStatusLabelMap[session.status]}
							className={sessionStatusIconClassNameMap[session.status]}
						/>
					</div>
				</TableCell>
				<TableCell className={pastCellClassName}>
					<SessionCustomerCell
						onSearch={onReceiptSearch}
						rowId={session._id}
						session={session}
					/>
				</TableCell>
				<TableCell className={pastCellClassName}>
					<AdminTableInfoPopover
						content={relativeDateLabel}
						className="flex w-full flex-col gap-1 whitespace-normal">
						<p className="font-medium whitespace-nowrap">{formatBookingDateMedium(session.date)}</p>
						<p className="text-sm text-muted-foreground">
							{session.duration
								? `${formatBookingTimeLabel(session.time)} · ${formatAdminDashboardDuration(session.duration)}`
								: formatBookingTimeLabel(session.time)}
						</p>
					</AdminTableInfoPopover>
				</TableCell>
				<TableCell className={pastCellClassName}>
					<SessionServiceCell
						className="min-w-48"
						session={session}
					/>
				</TableCell>
				<TableCell className={pastCellClassName}>
					<SessionContactCell
						onSearch={onReceiptSearch}
						rowId={session._id}
						session={session}
					/>
				</TableCell>
				<TableCell className={cn("text-center", pastCellClassName)}>
					<PackageSessionProgress
						label={packageSessionProgressLabel}
						onReceiptSearch={onReceiptSearch}
						receiptNumber={packageReceiptNumber}
					/>
				</TableCell>
				<TableCell className={pastCellClassName}>
					<SessionNotesCell
						session={session}
						isPastSession={isPastSession}
					/>
				</TableCell>
				<TableCell className={cn("text-right tabular-nums", pastCellClassName)}>
					<SessionAmountCell
						rowId={session._id}
						session={session}
					/>
				</TableCell>
				<TableCell>
					<div className="flex flex-col gap-1">
						<div className="flex justify-center">
							{edits ? (
								<SessionEditsToggle
									sessionName={session.name}
									edits={edits}
									expanded={editsExpanded}
									rowId={editsRowId}
									onToggle={() => setEditsExpanded((expanded) => !expanded)}
								/>
							) : (
								<SessionDeliverableBadge
									session={session}
									isDeliverable={isDeliverable}
									onReview={() => deliverablesEmailAction.setIsDeliverablesEmailDialogOpen(true)}
								/>
							)}
						</div>
						{assignedEditorContent}
					</div>
				</TableCell>
				<TableCell className={pastCellClassName}>
					<div className="flex flex-col gap-1 whitespace-normal">
						<p className="font-medium whitespace-nowrap">
							{formatShortMonthFullDate(session.pendingPaymentCreatedAt)}
						</p>
						<p className="text-sm text-muted-foreground">
							{formatBookingTimestampTime(session.pendingPaymentCreatedAt)}
						</p>
					</div>
				</TableCell>
				<TableCell>
					<SessionActions
						deliverablesEmailAction={deliverablesEmailAction}
						onReceiptSearch={onReceiptSearch}
						session={session}
					/>
				</TableCell>
			</TableRow>
			{edits ? (
				<SessionEditsInsetRow
					colSpan={11}
					id={editsRowId}
					isExpanded={editsExpanded}>
					<AdminSessionEditsTable
						session={session}
						edits={edits}
						canSend={isDeliverable}
					/>
				</SessionEditsInsetRow>
			) : null}
		</>
	);
}
