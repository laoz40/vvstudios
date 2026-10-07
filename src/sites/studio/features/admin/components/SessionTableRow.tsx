import { useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { TableCell, TableRow } from "#/components/ui/table";
import { toast } from "sonner";
import { exhaustiveCheck } from "#/lib/result";
import { cn } from "#/lib/utils";
import { AdminTableInfoPopover } from "#studio/features/admin/components/AdminTableInfoPopover";
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
	isDeliverableSession
} from "#studio/features/admin/lib/session-edit-status";
import { SessionServiceCell } from "#studio/features/sessions/components/SessionServiceCell";
import { useDeliverablesEmailAction } from "#studio/features/admin/hooks/useDeliverablesEmailAction";
import {
	formatAdminDashboardDuration,
	getPackageSessionProgressLabel,
	type SessionRecord
} from "#studio/features/admin/lib/admin-sessions";
import {
	formatAudAmount,
	getAudAmountRowShowCents
} from "#studio/features/admin/lib/remaining-balance";
import { getStripeInvoiceAmountClassName } from "#studio/features/admin/lib/stripe-invoice-billing";
import { calculateBookingReceiptAmounts } from "#studio/features/booking-invoice/lib/calculate-booking-receipt-amounts";
import { formatAdminSearchNarrowQuery } from "#studio/features/admin/lib/admin-search-narrow";
import {
	formatShortMonthFullDate,
	formatBookingDateMedium,
	formatBookingRelativeDate,
	formatBookingTimestampTime,
	formatBookingTimeLabel,
	isUpcomingBooking
} from "#studio/lib/bookingdatetime";

const driveWorkflowAttentionMessage = "Google Drive needs attention";

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

function getNextSessionNotesView(notesView: SessionNotesView): SessionNotesView {
	switch (notesView) {
		case "client":
			return "editor";
		case "editor":
			return "admin";
		case "admin":
			return "client";
		default:
			return exhaustiveCheck(notesView);
	}
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

	// Upcoming sessions default to client notes; past sessions default to editor notes.
	useEffect(() => {
		setNotesView(getDefaultSessionNotesView(isPastSession));
	}, [isPastSession]);

	const notesLabel = sessionNotesViewLabelMap[notesView];
	const visibleNotes = getSessionNotesForView(session, notesView);
	const notesText = visibleNotes || "-";

	function toggleNotesView() {
		const nextNotesView = getNextSessionNotesView(notesView);
		setNotesView(nextNotesView);
		toast.info(`${sessionNotesViewLabelMap[nextNotesView]} notes displayed.`);
	}

	return (
		<button
			type="button"
			className="w-full text-left text-sm whitespace-normal text-muted-foreground select-text"
			onClick={toggleNotesView}>
			<span className="font-medium text-foreground">{notesLabel}: </span>
			{notesText}
		</button>
	);
}

function SessionAmountCell({ rowId, session }: { rowId: string; session: SessionRecord }) {
	const packageSessionProgressLabel = getPackageSessionProgressLabel(session);

	const showReceiptAmount =
		!packageSessionProgressLabel &&
		(session.status === "confirmed" || session.status === "email_failed");

	const stripeInvoicesSummary = session.stripeInvoicesSummary;

	if (!showReceiptAmount && !stripeInvoicesSummary) {
		return <p className={packageSessionProgressLabel ? "text-muted-foreground" : undefined}>-</p>;
	}

	const receiptAmount = showReceiptAmount
		? calculateBookingReceiptAmounts(session).totalPaidAmount
		: null;

	const stripeInvoiceAmount = stripeInvoicesSummary?.totalAmount ?? null;

	const rowAmounts = [receiptAmount, stripeInvoiceAmount].filter(
		(amount): amount is number => amount !== null
	);

	const showCents = getAudAmountRowShowCents(rowAmounts);

	const receiptAmountLabel =
		receiptAmount !== null ? formatAudAmount(receiptAmount, { showCents }) : null;

	const stripeInvoiceAmountLabel =
		stripeInvoiceAmount !== null ? formatAudAmount(stripeInvoiceAmount, { showCents }) : null;

	return (
		<div className="flex flex-col items-end gap-1">
			{receiptAmountLabel ? (
				<p className="text-green">
					<PrivacySensitiveText
						rowId={rowId}
						value={receiptAmountLabel}
						label="session amount"
						copyable={false}>
						{receiptAmountLabel}
					</PrivacySensitiveText>
				</p>
			) : null}
			{stripeInvoiceAmountLabel && stripeInvoicesSummary ? (
				<p className={getStripeInvoiceAmountClassName(stripeInvoicesSummary.paymentStatus)}>
					<PrivacySensitiveText
						rowId={rowId}
						value={stripeInvoiceAmountLabel}
						label="Stripe invoice amount"
						copyable={false}>
						{stripeInvoiceAmountLabel}
					</PrivacySensitiveText>
				</p>
			) : null}
		</div>
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

export function SessionTableRow({ onReceiptSearch, session }: SessionTableRowProps) {
	const isPastSession = !isUpcomingBooking(session.date, session.time);
	const relativeDateLabel = formatBookingRelativeDate(session.date);
	const packageSessionProgressLabel = getPackageSessionProgressLabel(session);
	const packageReceiptNumber = session.receiptNumber;
	const assignedEditorDisplayName = session.assignedEditorDisplayName ?? null;
	const deliverablesEmailAction = useDeliverablesEmailAction(session);
	const deliverableStatus = isDeliverableSession(session) ? getDeliverableStatus(session) : null;
	const pastCellClassName = isPastSession ? "opacity-70" : undefined;

	return (
		<TableRow
			key={session._id}
			className={isPastSession ? "text-muted-foreground" : undefined}>
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
						{deliverableStatus === "review" ? (
							<button
								type="button"
								onClick={() => deliverablesEmailAction.setIsDeliverablesEmailDialogOpen(true)}>
								<Badge
									variant={deliverableStatusBadgeVariantMap.review}
									className={deliverableStatusBadgeClassNameMap.review}>
									{deliverableStatusLabelMap.review}
								</Badge>
							</button>
						) : deliverableStatus ? (
							<Badge
								variant={deliverableStatusBadgeVariantMap[deliverableStatus]}
								className={deliverableStatusBadgeClassNameMap[deliverableStatus]}>
								{deliverableStatusLabelMap[deliverableStatus]}
							</Badge>
						) : null}
					</div>
					{assignedEditorDisplayName ? (
						<SessionEditorNameCell
							editorName={assignedEditorDisplayName}
							onSearch={onReceiptSearch}
							rowId={session._id}
							showDriveAlert={session.hasDriveWorkflowFailure === true}
						/>
					) : session.hasDriveWorkflowFailure ? (
						<p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
							<DriveWorkflowAttentionIcon />
							<span>Google Drive</span>
						</p>
					) : null}
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
	);
}
