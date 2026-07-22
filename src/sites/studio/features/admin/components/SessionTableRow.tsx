import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { TableCell, TableRow } from "#/components/ui/table";
import { cn } from "#/lib/utils";
import { SessionActions } from "#studio/features/admin/components/SessionActions";
import { StatusIcon } from "#studio/features/admin/components/StatusIcon";
import {
	CopyableText,
	formatDashboardAddonLabel,
	formatInstagramHandle
} from "#studio/features/admin/components/AdminDashboardTableUtils";
import {
	bookingStatusIconClassNameMap,
	bookingStatusIconMap,
	bookingStatusLabelMap,
	deliverableStatusBadgeClassNameMap,
	deliverableStatusBadgeVariantMap,
	deliverableStatusLabelMap,
	getDeliverableStatus,
	isDeliverableSession
} from "#studio/features/admin/lib/booking-edit-status";
import {
	getPackageSessionProgressLabel,
	type BookingRecord
} from "#studio/features/admin/lib/admin-bookings";
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
	booking: BookingRecord;
	onPackageFilterClick: (invoiceNumber: string) => void;
};

function SessionCustomerCell({ booking }: { booking: BookingRecord }) {
	return (
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
								ABN
							</CopyableText>
						</>
					) : null}
				</p>
			) : null}
		</div>
	);
}

function SessionContactCell({ booking }: { booking: BookingRecord }) {
	return (
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
	);
}

function SessionDetailsCell({ booking }: { booking: BookingRecord }) {
	return (
		<div className="flex min-w-48 flex-col gap-2 whitespace-normal">
			<p className="font-medium">{booking.service}</p>
			{booking.addons.length > 0 ? (
				<div className="flex flex-wrap gap-1">
					{booking.addons.map((addon) => (
						<Badge
							key={addon}
							variant="outline">
							{formatDashboardAddonLabel(addon, booking)}
						</Badge>
					))}
				</div>
			) : (
				<p className="text-sm text-muted-foreground">No add-ons</p>
			)}
		</div>
	);
}

function RemainingBalanceCell({ booking }: { booking: BookingRecord }) {
	const packageSessionProgressLabel = getPackageSessionProgressLabel(booking);
	const showRemainingBalance =
		!packageSessionProgressLabel &&
		(booking.status === "confirmed" || booking.status === "email_failed");

	if (!showRemainingBalance) {
		return <p className={packageSessionProgressLabel ? "text-muted-foreground" : undefined}>-</p>;
	}

	const className = booking.paidRemainingBalance === true ? "text-green" : "text-destructive";
	return <p className={className}>{formatAudAmount(getRemainingBalanceAmount(booking))}</p>;
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

export function SessionTableRow({ booking, onPackageFilterClick }: SessionTableRowProps) {
	const isPastBooking = !isUpcomingBooking(booking.date, booking.time);
	const relativeDateLabel = formatBookingRelativeDate(booking.date);
	const packageSessionProgressLabel = getPackageSessionProgressLabel(booking);
	const packageInvoiceNumber = booking.multiBookingInvoiceNumber;
	const deliverableStatus = isDeliverableSession(booking) ? getDeliverableStatus(booking) : null;
	const pastCellClassName = isPastBooking ? "opacity-70" : undefined;

	return (
		<TableRow
			key={booking._id}
			className={isPastBooking ? "text-muted-foreground" : undefined}>
			<TableCell className={cn("text-center", pastCellClassName)}>
				<div className="flex justify-center">
					<StatusIcon
						icon={bookingStatusIconMap[booking.status]}
						label={bookingStatusLabelMap[booking.status]}
						className={bookingStatusIconClassNameMap[booking.status]}
					/>
				</div>
			</TableCell>
			<TableCell className={pastCellClassName}>
				<SessionCustomerCell booking={booking} />
			</TableCell>
			<TableCell className={pastCellClassName}>
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
			<TableCell className={pastCellClassName}>
				<SessionDetailsCell booking={booking} />
			</TableCell>
			<TableCell className={pastCellClassName}>
				<SessionContactCell booking={booking} />
			</TableCell>
			<TableCell className={cn("text-center", pastCellClassName)}>
				<PackageSessionProgress
					invoiceNumber={packageInvoiceNumber}
					label={packageSessionProgressLabel}
					onPackageFilterClick={onPackageFilterClick}
				/>
			</TableCell>
			<TableCell className={pastCellClassName}>
				<p className="whitespace-normal text-sm text-muted-foreground">
					{booking.notes?.trim() || "No notes"}
				</p>
			</TableCell>
			<TableCell className={cn("text-center tabular-nums", pastCellClassName)}>
				<RemainingBalanceCell booking={booking} />
			</TableCell>
			<TableCell className="text-center">
				{deliverableStatus ? (
					<Badge
						variant={deliverableStatusBadgeVariantMap[deliverableStatus]}
						className={deliverableStatusBadgeClassNameMap[deliverableStatus]}>
						{deliverableStatusLabelMap[deliverableStatus]}
					</Badge>
				) : null}
			</TableCell>
			<TableCell className={pastCellClassName}>
				<div className="flex flex-col gap-1 whitespace-normal">
					<p className="font-medium">{formatShortMonthFullDate(booking.pendingPaymentCreatedAt)}</p>
					<p className="text-sm text-muted-foreground">
						{formatBookingTimestampTime(booking.pendingPaymentCreatedAt)}
					</p>
				</div>
			</TableCell>
			<TableCell>
				<SessionActions booking={booking} />
			</TableCell>
		</TableRow>
	);
}
