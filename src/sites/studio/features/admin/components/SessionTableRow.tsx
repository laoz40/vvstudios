import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { TableCell, TableRow } from "#/components/ui/table";
import { cn } from "#/lib/utils";
import { SessionActions } from "#studio/features/admin/components/SessionActions";
import {
	CopyableText,
	formatInstagramHandle
} from "#studio/features/admin/components/AdminDashboardTableUtils";
import {
	bookingStatusBadgeClassNameMap,
	bookingStatusBadgeVariantMap,
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
import { formatEditingAddonLabel } from "#studio/features/booking-form/lib/editing-addon-quantities";
import {
	formatBookingDateMedium,
	formatBookingRelativeDate,
	formatBookingTimestamp,
	formatBookingTimeLabel,
	isUpcomingBooking
} from "#studio/lib/bookingdatetime";

type SessionTableRowProps = {
	booking: BookingRecord;
	onPackageFilterClick: (invoiceNumber: string) => void;
};

export function SessionTableRow({ booking, onPackageFilterClick }: SessionTableRowProps) {
	const isPastBooking = !isUpcomingBooking(booking.date, booking.time);
	const relativeDateLabel = formatBookingRelativeDate(booking.date);
	const packageSessionProgressLabel = getPackageSessionProgressLabel(booking);
	const packageInvoiceNumber = booking.multiBookingInvoiceNumber;
	const isRemainingBalancePaid = booking.paidRemainingBalance === true;
	const remainingBalanceLabel = formatAudAmount(getRemainingBalanceAmount(booking));
	const showRemainingBalance =
		!packageSessionProgressLabel &&
		(booking.status === "confirmed" || booking.status === "email_failed");
	const deliverableStatus = isDeliverableSession(booking) ? getDeliverableStatus(booking) : null;

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
										ABN
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
				{packageSessionProgressLabel ? (
					packageInvoiceNumber ? (
						<Button
							type="button"
							variant="link"
							className="h-auto p-0 font-medium text-foreground"
							onClick={() => onPackageFilterClick(packageInvoiceNumber)}>
							{packageSessionProgressLabel}
						</Button>
					) : (
						<p className="font-medium">{packageSessionProgressLabel}</p>
					)
				) : showRemainingBalance ? (
					<p className={isRemainingBalancePaid ? "text-green" : "text-destructive"}>
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
}
