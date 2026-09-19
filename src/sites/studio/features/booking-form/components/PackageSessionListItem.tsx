import { Armchair, EllipsisVertical, Globe, Music } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger
} from "#/components/ui/dropdown-menu";
import type { Id } from "#convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";
import { isPackageSessionLocked } from "#studio/features/booking-form/lib/package-scheduling-rules";
import {
	formatBookingDateCompact,
	formatBookingTimeRange,
	formatBookingTimestampDateLong
} from "#studio/lib/bookingdatetime";
import { cn } from "#/lib/utils";

const SESSION_STATUS_DETAILS = {
	dateRequired: { label: "Date Required", textClassName: "text-destructive" },
	upcoming: { label: "Upcoming", textClassName: "text-green" },
	completed: { label: "Completed", textClassName: "text-foreground" }
} as const;

type PackageData = NonNullable<
	FunctionReturnType<typeof api.packageScheduling.getPackageByToken>[1]
>;

type PackageBooking = PackageData["sessions"][number];

type PackageSession =
	| { booking: PackageBooking; key: string; status: "completed" | "upcoming" }
	| { booking: null; key: string; status: "dateRequired" };

interface PackageSessionActionHandlers {
	onRequestUnschedule: (bookingId: Id<"bookings">, date: string) => void;
	onSessionClose: () => void;
	onSessionSelect: (sessionKey: string, dateValue?: string, time?: string) => void;
}

interface PackageSessionListItemProps {
	actions: PackageSessionActionHandlers;
	activeSessionKey: string | null;
	currentTimestamp: number;
	duration: PackageData["duration"];
	highlightedBookingId: Id<"bookings"> | null;
	leadTimeMinutes: number;
	session: PackageSession;
	sessionNumber: number;
}

export function PackageSessionListItem({
	actions,
	activeSessionKey,
	currentTimestamp,
	duration,
	highlightedBookingId,
	leadTimeMinutes,
	session,
	sessionNumber
}: PackageSessionListItemProps) {
	const booking = session.booking;

	const isSessionLocked =
		booking !== null &&
		isPackageSessionLocked(booking.sessionStartAt, leadTimeMinutes, currentTimestamp);

	const isActive = activeSessionKey === session.key;
	const canEdit = !isSessionLocked;
	const isHighlighted = highlightedBookingId === booking?._id;
	const statusDetails = SESSION_STATUS_DETAILS[session.status];

	function handleOpenSession() {
		if (!canEdit) {
			return;
		}

		if (isActive) {
			actions.onSessionClose();

			return;
		}

		actions.onSessionSelect(session.key, booking?.date, booking?.time);
	}

	return (
		<div
			data-slot="package-session-item"
			className={cn(
				"rounded-xl border bg-surface-subtle px-4 last:border-b sm:px-6",
				"text-card-foreground",
				"shadow-lg transition-colors duration-500",
				session.status === "completed" && "border-muted bg-background opacity-70 shadow-none!",
				isHighlighted && "border-primary"
			)}>
			<div className="flex min-h-24 w-full items-center justify-between gap-4 py-5 sm:gap-6 md:py-6">
				<span className="shrink-0 text-sm text-muted-foreground">{sessionNumber}</span>
				<span className="flex min-w-0 flex-1 flex-col items-start gap-1">
					<Badge
						variant="ghost"
						className={cn(
							"rounded-none border-0 bg-transparent p-0 tracking-wider",
							statusDetails.textClassName
						)}>
						{statusDetails.label}
					</Badge>
					<PackageSessionBookingDetails
						booking={booking}
						duration={duration}
					/>
				</span>
				<span className="ml-auto flex shrink-0 items-center justify-end gap-2">
					{session.status === "upcoming" && isSessionLocked ? (
						<span className="hidden whitespace-nowrap text-right text-xs text-muted-foreground md:inline">
							This session can no longer be edited.
						</span>
					) : null}
					{canEdit ? (
						<PackageSessionActions
							actions={actions}
							booking={booking}
							isActive={isActive}
							onToggleSession={handleOpenSession}
							sessionKey={session.key}
							sessionNumber={sessionNumber}
						/>
					) : null}
				</span>
			</div>
		</div>
	);
}

function RecordingSpaceServiceIcon({ service }: { service: PackageBooking["service"] }) {
	if (service === "Table Setup") {
		return (
			<svg
				aria-label="Table Setup"
				className="size-4"
				viewBox="2 1 20 20"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2">
				<path d="m4 11 4-5h8l4 5H4Z" />
				<path d="M7 11v6M17 11v6" />
			</svg>
		);
	}

	if (service === "Music Setup") {
		return (
			<Music
				aria-label="Music Setup"
				className="size-4"
			/>
		);
	}

	return (
		<Armchair
			aria-label="Armchair Setup"
			className="size-4"
		/>
	);
}

function PackageSessionBookingDetails({
	booking,
	duration
}: {
	booking: PackageBooking | null;
	duration: PackageData["duration"];
}) {
	if (!booking) {
		return (
			<span className="block select-text! text-left text-base text-muted-foreground transition-colors duration-500">
				<span className="md:hidden">Set your session date</span>
				<span className="hidden md:inline">Pick a date to confirm your session</span>
			</span>
		);
	}

	return (
		<span className="block select-text! text-left text-base text-muted-foreground transition-colors duration-500">
			<span className="font-semibold text-foreground">
				<span className="md:hidden">{formatBookingDateCompact(booking.date)}</span>
				<span className="hidden md:inline">
					{formatBookingTimestampDateLong(booking.sessionStartAt)}
				</span>
			</span>{" "}
			· {formatBookingTimeRange(booking.time, duration)}
			<span className="ml-2 inline-flex items-center gap-1.5 align-text-bottom text-foreground">
				<span title={booking.service}>
					<RecordingSpaceServiceIcon service={booking.service} />
				</span>
				{booking.addons.includes("Remote Podcast") ? (
					<span title="Remote Podcast">
						<Globe
							aria-label="Remote Podcast"
							className="size-4"
						/>
					</span>
				) : null}
			</span>
		</span>
	);
}

interface PackageSessionActionsProps {
	actions: PackageSessionActionHandlers;
	booking: PackageBooking | null;
	isActive: boolean;
	onToggleSession: () => void;
	sessionKey: string;
	sessionNumber: number;
}

function PackageSessionActions({
	actions,
	booking,
	isActive,
	onToggleSession,
	sessionKey,
	sessionNumber
}: PackageSessionActionsProps) {
	let editButtonLabel = "SCHEDULE";

	if (booking) {
		editButtonLabel = "EDIT";
	}

	if (isActive) {
		editButtonLabel = "CLOSE";
	}

	return (
		<>
			{booking ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<span
							role="button"
							tabIndex={0}
							aria-label={`Open session ${sessionNumber} actions`}
							className={cn(
								"inline-flex size-9 items-center justify-center rounded-lg border md:hidden",
								"border-foreground/15 bg-background/30 text-foreground/85 shadow-md",
								"hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
							)}
							onClick={(event) => {
								event.stopPropagation();
							}}
							onKeyDown={(event) => {
								event.stopPropagation();
							}}>
							<EllipsisVertical className="size-4" />
						</span>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem
							onSelect={() => {
								if (isActive) {
									actions.onSessionClose();

									return;
								}

								actions.onSessionSelect(sessionKey, booking.date, booking.time);
							}}>
							{isActive ? "Close" : "Edit"}
						</DropdownMenuItem>
						<DropdownMenuItem
							variant="destructive"
							onSelect={() => {
								actions.onRequestUnschedule(booking._id, booking.date);
							}}>
							Unschedule
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			) : null}
			{booking ? (
				<span
					role="button"
					tabIndex={0}
					className={cn(
						"peer/unschedule hidden min-h-8 min-w-16 items-center justify-center rounded-lg border px-3 py-1 md:inline-flex",
						"border-foreground/15 bg-background/30 text-foreground/85",
						"outline-none text-xs font-medium tracking-wider shadow-md hover:text-destructive focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
					)}
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						actions.onRequestUnschedule(booking._id, booking.date);
					}}
					onKeyDown={(event) => {
						if (event.key !== "Enter" && event.key !== " ") {
							return;
						}

						event.preventDefault();
						event.stopPropagation();
						actions.onRequestUnschedule(booking._id, booking.date);
					}}>
					UNSCHEDULE
				</span>
			) : null}
			<span
				role="button"
				tabIndex={0}
				className={cn(
					booking ? "hidden md:inline-flex" : "inline-flex",
					"min-h-8 min-w-16 cursor-pointer items-center justify-center rounded-lg border px-3 py-1",
					!booking && !isActive
						? "border-primary bg-primary text-primary-foreground hover:text-primary-foreground"
						: "border-foreground/15 bg-background/30 text-foreground/85",
					"text-xs font-medium tracking-wider shadow-md hover:text-primary peer-hover/unschedule:text-foreground/85",
					"outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
				)}
				onClick={onToggleSession}
				onKeyDown={(event) => {
					if (event.key !== "Enter" && event.key !== " ") {
						return;
					}

					event.preventDefault();
					onToggleSession();
				}}>
				{editButtonLabel}
			</span>
		</>
	);
}
