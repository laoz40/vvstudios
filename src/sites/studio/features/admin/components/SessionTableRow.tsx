import { useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { TableCell, TableRow } from "#/components/ui/table";
import { toast } from "sonner";
import { cn } from "#/lib/utils";
import { SessionActions } from "#studio/features/admin/components/SessionActions";
import type { ActiveEditor } from "#studio/features/admin/components/SessionEditorAssignment";
import { StatusIcon } from "#studio/features/admin/components/StatusIcon";
import {
	CopyableText,
	formatInstagramHandle
} from "#studio/features/admin/components/AdminDashboardTableUtils";
import { formatDashboardAddonLabel } from "#studio/features/booking-form/lib/editing-addon-quantities";
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
import { useDeliverablesEmailAction } from "#studio/features/admin/hooks/useDeliverablesEmailAction";
import {
	getPackageSessionProgressLabel,
	type SessionRecord
} from "#studio/features/admin/lib/admin-sessions";
import {
	formatAudAmount,
	getRemainingBalanceAmount
} from "#studio/features/admin/lib/remaining-balance";
import {
	formatShortMonthFullDate,
	formatBookingDateMedium,
	formatBookingRelativeDate,
	formatBookingTimestampTime,
	formatBookingTimeLabel,
	isUpcomingBooking
} from "#studio/lib/bookingdatetime";

type SessionTableRowProps = {
	activeEditors: ActiveEditor[];
	assignedEditorDisplayName: string | null;
	session: SessionRecord;
	onPackageFilterClick: (invoiceNumber: string) => void;
};

function SessionCustomerCell({ session }: { session: SessionRecord }) {
	return (
		<div className="flex flex-col gap-1 whitespace-normal">
			<p className="font-medium">
				<CopyableText
					value={session.name}
					label="customer name">
					{session.name}
				</CopyableText>
			</p>
			{session.accountName || session.abn ? (
				<p className="text-sm">
					{session.accountName ? (
						<CopyableText
							value={session.accountName}
							label="account name">
							{session.accountName}
						</CopyableText>
					) : null}
					{session.abn ? (
						<>
							{session.accountName ? " · " : ""}
							<CopyableText
								value={session.abn}
								label="ABN">
								ABN
							</CopyableText>
						</>
					) : null}
				</p>
			) : null}
		</div>
	);
}

function SessionContactCell({ session }: { session: SessionRecord }) {
	return (
		<div className="flex flex-col gap-1 whitespace-normal">
			<p className="break-all font-medium">
				<CopyableText
					value={session.email}
					label="email">
					{session.email}
				</CopyableText>
			</p>
			<p className="text-sm">
				{session.phone ? (
					<CopyableText
						value={session.phone}
						label="phone number">
						{session.phone}
					</CopyableText>
				) : (
					<span>No phone provided</span>
				)}
				{session.instagramHandle ? (
					<>
						{" · "}
						<CopyableText
							value={formatInstagramHandle(session.instagramHandle)}
							label="Instagram handle">
							{formatInstagramHandle(session.instagramHandle)}
						</CopyableText>
					</>
				) : null}
			</p>
		</div>
	);
}

function SessionDetailsCell({ session }: { session: SessionRecord }) {
	return (
		<div className="flex min-w-48 flex-col gap-2 whitespace-normal">
			<p className="font-medium">{session.service}</p>
			{session.addons.length > 0 ? (
				<div className="flex flex-wrap gap-1">
					{session.addons.map((addon) => (
						<Badge
							key={addon}
							variant="outline">
							{formatDashboardAddonLabel(addon, session)}
						</Badge>
					))}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">No add-ons</p>
			)}
		</div>
	);
}

type SessionNotesView = "client" | "editor";

function getDefaultSessionNotesView(
	isPastSession: boolean,
	hasEditorNotes: boolean
): SessionNotesView {
	if (isPastSession && hasEditorNotes) {
		return "editor";
	}

	return "client";
}

function SessionNotesCell({
	session,
	isPastSession
}: {
	session: SessionRecord;
	isPastSession: boolean;
}) {
	const hasEditorNotes = Boolean(session.editorNotes?.trim());
	const canToggleNotes = isPastSession && hasEditorNotes;
	const [notesView, setNotesView] = useState<SessionNotesView>(() =>
		getDefaultSessionNotesView(isPastSession, hasEditorNotes)
	);

	// Past sessions with editor notes default to editor; otherwise keep client notes visible.
	useEffect(() => {
		setNotesView(getDefaultSessionNotesView(isPastSession, hasEditorNotes));
	}, [isPastSession, hasEditorNotes]);

	const visibleNotes = notesView === "client" ? session.notes?.trim() : session.editorNotes?.trim();
	const notesLabel = notesView === "client" ? "Client" : "Editor";
	const notesText = visibleNotes || "-";

	if (!canToggleNotes) {
		return (
			<p className="whitespace-normal text-sm text-muted-foreground">
				{visibleNotes ? <span className="font-medium text-foreground">{notesLabel}: </span> : null}
				{notesText}
			</p>
		);
	}

	function toggleNotesView() {
		const nextNotesView = notesView === "client" ? "editor" : "client";
		setNotesView(nextNotesView);
		toast.info(`${nextNotesView === "client" ? "Client" : "Editor"} notes displayed.`);
	}

	return (
		<button
			type="button"
			className="w-full whitespace-normal text-left text-sm text-muted-foreground"
			onClick={toggleNotesView}>
			{visibleNotes ? <span className="font-medium text-foreground">{notesLabel}: </span> : null}
			{notesText}
		</button>
	);
}

function RemainingBalanceCell({ session }: { session: SessionRecord }) {
	const packageSessionProgressLabel = getPackageSessionProgressLabel(session);
	const showRemainingBalance =
		!packageSessionProgressLabel &&
		(session.status === "confirmed" || session.status === "email_failed");

	if (!showRemainingBalance) {
		return <p className={packageSessionProgressLabel ? "text-muted-foreground" : undefined}>-</p>;
	}

	const className = session.paidRemainingBalance === true ? "text-green" : "text-destructive";
	return <p className={className}>{formatAudAmount(getRemainingBalanceAmount(session))}</p>;
}

function PackageSessionProgress({
	invoiceNumber,
	label,
	onPackageFilterClick
}: {
	invoiceNumber: string | undefined;
	label: string | null;
	onPackageFilterClick: (invoiceNumber: string) => void;
}) {
	if (!label) {
		return <p>-</p>;
	}

	if (!invoiceNumber) {
		return <p className="text-sm font-medium">{label}</p>;
	}

	return (
		<Button
			type="button"
			variant="link"
			className="h-auto p-0 text-sm font-medium text-foreground"
			onClick={() => onPackageFilterClick(invoiceNumber)}>
			{label}
		</Button>
	);
}

export function SessionTableRow({
	activeEditors,
	assignedEditorDisplayName,
	session,
	onPackageFilterClick
}: SessionTableRowProps) {
	const isPastSession = !isUpcomingBooking(session.date, session.time);
	const relativeDateLabel = formatBookingRelativeDate(session.date);
	const packageSessionProgressLabel = getPackageSessionProgressLabel(session);
	const packageInvoiceNumber = session.multiBookingInvoiceNumber;
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
				<SessionCustomerCell session={session} />
			</TableCell>
			<TableCell className={pastCellClassName}>
				<div
					className="flex cursor-help flex-col gap-1 whitespace-normal"
					title={relativeDateLabel}>
					<p className="font-medium">{formatBookingDateMedium(session.date)}</p>
					<p className="text-sm">
						{formatBookingTimeLabel(session.time)}
						{session.duration ? ` · ${session.duration}` : ""}
					</p>
				</div>
			</TableCell>
			<TableCell className={pastCellClassName}>
				<SessionDetailsCell session={session} />
			</TableCell>
			<TableCell className={pastCellClassName}>
				<SessionContactCell session={session} />
			</TableCell>
			<TableCell className={cn("text-center", pastCellClassName)}>
				<PackageSessionProgress
					invoiceNumber={packageInvoiceNumber}
					label={packageSessionProgressLabel}
					onPackageFilterClick={onPackageFilterClick}
				/>
			</TableCell>
			<TableCell className={pastCellClassName}>
				<SessionNotesCell
					session={session}
					isPastSession={isPastSession}
				/>
			</TableCell>
			<TableCell className={cn("text-center tabular-nums", pastCellClassName)}>
				<RemainingBalanceCell session={session} />
			</TableCell>
			<TableCell className="text-center">
				<div className="flex flex-col items-center gap-1">
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
					{assignedEditorDisplayName ? (
						<p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
							{session.hasDriveWorkflowFailure ? (
								<span
									className="cursor-help"
									title="Google Drive needs attention">
									<CircleAlert
										aria-label="Google Drive needs attention"
										className="size-3.5 text-destructive"
									/>
								</span>
							) : null}
							{assignedEditorDisplayName}
						</p>
					) : session.hasDriveWorkflowFailure ? (
						<p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
							<span
								className="cursor-help"
								title="Google Drive needs attention">
								<CircleAlert
									aria-label="Google Drive needs attention"
									className="size-3.5 text-destructive"
								/>
							</span>
							<span>Google Drive</span>
						</p>
					) : null}
				</div>
			</TableCell>
			<TableCell className={pastCellClassName}>
				<div className="flex flex-col gap-1 whitespace-normal">
					<p className="font-medium">{formatShortMonthFullDate(session.pendingPaymentCreatedAt)}</p>
					<p className="text-sm text-muted-foreground">
						{formatBookingTimestampTime(session.pendingPaymentCreatedAt)}
					</p>
				</div>
			</TableCell>
			<TableCell>
				<SessionActions
					activeEditors={activeEditors}
					deliverablesEmailAction={deliverablesEmailAction}
					session={session}
				/>
			</TableCell>
		</TableRow>
	);
}
