import { useState, type RefObject } from "react";
import { useMutation } from "convex/react";
import { ChevronDown, CircleX, LoaderCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge, badgeVariants } from "#/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuTrigger
} from "#/components/ui/dropdown-menu";
import CheckedIcon from "#/components/ui/checked-icon";
import KeyframesIcon from "#/components/ui/keyframes-icon";
import type { AnimatedIconHandle } from "#/components/ui/types";
import { cn } from "#/lib/utils";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import { AnimatedDropdownMenuItem } from "#studio/features/admin/components/AnimatedDropdownMenuItem";
import {
	deliverableStatusBadgeClassNameMap,
	deliverableStatusBadgeVariantMap,
	deliverableStatusLabelMap,
	type DeliverableStatus
} from "#studio/features/admin/lib/session-edit-status";
import type { EditorSession } from "#studio/features/editor/lib/editor-sessions";

const deliverableBadgeIconSize = 16;

const deliverableBadgeClassName = "px-1.5 text-sm leading-tight [&_svg]:size-4 [&>svg]:size-4";

type DeliverableStatusOption = { editStatus: DeliverableStatus; label: string };

function getDeliverableStatusLabel(status: DeliverableStatus) {
	if (status === "review") {
		return "Sent for review";
	}

	return deliverableStatusLabelMap[status];
}

function getEditorDeliverableStatusOptions(status: DeliverableStatus): DeliverableStatusOption[] {
	if (status === "completed") {
		return [{ editStatus: "editing", label: "Still editing" }];
	}

	if (status === "to_edit") {
		return [
			{ editStatus: "editing", label: "Start editing" },
			{ editStatus: "review", label: "Ready to review" }
		];
	}

	if (status === "editing") {
		return [
			{ editStatus: "to_edit", label: "Not started" },
			{ editStatus: "review", label: "Ready to review" }
		];
	}

	return [
		{ editStatus: "editing", label: "I'm still editing" },
		{ editStatus: "to_edit", label: "Not started" }
	];
}

function renderDeliverableStatusIcon(
	status: DeliverableStatus,
	options?: { size?: number; iconRef?: RefObject<AnimatedIconHandle | null> }
) {
	const size = options?.size ?? deliverableBadgeIconSize;
	const iconRef = options?.iconRef;
	const iconClassName = "shrink-0 text-current";

	if (status === "editing") {
		return (
			<KeyframesIcon
				ref={iconRef}
				size={size}
				aria-hidden
				className={iconClassName}
			/>
		);
	}

	if (status === "review") {
		return (
			<CheckedIcon
				ref={iconRef}
				size={size}
				aria-hidden
				className={iconClassName}
			/>
		);
	}

	if (status === "completed") {
		return (
			<Send
				size={size}
				aria-hidden
				className={iconClassName}
			/>
		);
	}

	return (
		<CircleX
			size={size}
			aria-hidden
			className={iconClassName}
		/>
	);
}

function getStatusOptionMenuItemClassName(editStatus: DeliverableStatus) {
	if (editStatus === "editing") {
		return "hover:text-primary focus:text-primary hover:[&_svg]:text-primary focus:[&_svg]:text-primary";
	}

	if (editStatus === "review") {
		return "hover:text-blue-400 focus:text-blue-400 hover:[&_svg]:text-blue-400 focus:[&_svg]:text-blue-400";
	}

	if (editStatus === "to_edit") {
		return "hover:text-destructive focus:text-destructive hover:[&_svg]:text-destructive focus:[&_svg]:text-destructive";
	}

	return undefined;
}

export function EditorDeliverableStatusBadge({
	session,
	canManageDeliverables
}: {
	session: EditorSession;
	canManageDeliverables: boolean;
}) {
	const updateSessionEditStatus = useMutation(api.sessions.updateSessionEditStatus);
	const [isUpdating, setIsUpdating] = useState(false);
	const deliverableStatus: DeliverableStatus = session.editStatus ?? "to_edit";

	const statusOptions = canManageDeliverables
		? getEditorDeliverableStatusOptions(deliverableStatus)
		: [];

	const statusLabel = getDeliverableStatusLabel(deliverableStatus);

	const badgeClassName = cn(
		deliverableStatusBadgeClassNameMap[deliverableStatus],
		deliverableBadgeClassName
	);

	const badgeVariant = deliverableStatusBadgeVariantMap[deliverableStatus];

	async function handleStatusChange(editStatus: DeliverableStatus) {
		setIsUpdating(true);
		const [error] = await tryCatch(updateSessionEditStatus({ bookingId: session._id, editStatus }));
		setIsUpdating(false);

		if (error !== null) {
			toast.error("Unable to update this session's deliverables status.");

			return;
		}

		toast.success(
			`Deliverables changed to ${deliverableStatusLabelMap[editStatus].toLowerCase()}.`
		);
	}

	if (statusOptions.length === 0) {
		return (
			<Badge
				variant={badgeVariant}
				className={badgeClassName}>
				{renderDeliverableStatusIcon(deliverableStatus)}
				{statusLabel}
			</Badge>
		);
	}

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					disabled={isUpdating}
					className={cn(
						badgeVariants({ variant: badgeVariant }),
						badgeClassName,
						"cursor-pointer gap-0.5 pr-1 disabled:opacity-70"
					)}>
					{isUpdating ? (
						<LoaderCircle
							className="size-4 animate-spin"
							aria-hidden
						/>
					) : (
						renderDeliverableStatusIcon(deliverableStatus)
					)}
					{statusLabel}
					<ChevronDown
						className="size-4 opacity-80"
						aria-hidden
					/>
					<span className="sr-only">Change deliverables status for {session.name}</span>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				<DropdownMenuGroup>
					{statusOptions.map((option) => (
						<AnimatedDropdownMenuItem
							key={option.editStatus}
							className={getStatusOptionMenuItemClassName(option.editStatus)}
							onSelect={() => void handleStatusChange(option.editStatus)}
							renderIcon={(iconRef) =>
								renderDeliverableStatusIcon(option.editStatus, { size: 16, iconRef })
							}>
							{option.label}
						</AnimatedDropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
