import { useState } from "react";
import { useMutation } from "convex/react";
import { Ellipsis, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuTrigger
} from "#/components/ui/dropdown-menu";
import CheckedIcon from "#/components/ui/checked-icon";
import KeyframesIcon from "#/components/ui/keyframes-icon";
import PenIcon from "#/components/ui/pen-icon";
import BrandGoogleIcon from "#/components/ui/brand-google-icon";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import { AnimatedDropdownMenuItem } from "#studio/features/admin/components/AnimatedDropdownMenuItem";
import { SessionEditorNotesDialog } from "#studio/features/editor/components/SessionEditorNotesDialog";
import { deliverableStatusLabelMap } from "#studio/features/admin/lib/session-edit-status";
import { DeliverablesReviewDialog } from "#studio/features/editor/components/DeliverablesReviewDialog";
import type { EditorSession } from "#studio/features/editor/lib/editor-sessions";
import { EditorDriveFoldersDialog } from "#studio/features/editor/components/EditorDriveFoldersDialog";

type DeliverablesDialogState =
	| { status: "closed" }
	| { status: "drive" }
	| { status: "notes" }
	| { status: "review" };

export function EditorDeliverablesActions({
	session,
	canManageDeliverables
}: {
	session: EditorSession;
	canManageDeliverables: boolean;
}) {
	const updateSessionEditStatus = useMutation(api.sessions.updateSessionEditStatus);
	const submitSessionForReview = useMutation(api.sessions.submitSessionForReview);
	const [isUpdating, setIsUpdating] = useState(false);
	const [dialog, setDialog] = useState<DeliverablesDialogState>({ status: "closed" });
	const [driveLink, setDriveLink] = useState(session.deliverablesDriveLink ?? "");
	const [clientNotes, setClientNotes] = useState(session.deliverablesClientNotes ?? "");

	async function handleStatusChange(editStatus: "editing") {
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

	async function handleSubmitForReview() {
		setIsUpdating(true);
		const [error] = await tryCatch(
			submitSessionForReview({ bookingId: session._id, driveLink, clientNotes })
		);
		setIsUpdating(false);

		if (error !== null) {
			toast.error(
				error.reason === "INVALID_DRIVE_LINK"
					? "Enter a valid Google Drive link."
					: "Unable to submit deliverables for review."
			);
			return;
		}

		setDialog({ status: "closed" });
		toast.success("Deliverables submitted for admin review.");
	}

	return (
		<>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size={isUpdating ? "sm" : "icon-sm"}
						disabled={isUpdating}>
						{isUpdating ? (
							<>
								<LoaderCircle
									data-icon="inline-start"
									className="animate-spin"
								/>
								Updating
							</>
						) : (
							<>
								<Ellipsis aria-hidden />
								<span className="sr-only">Open deliverables actions for {session.name}</span>
							</>
						)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuGroup>
						<AnimatedDropdownMenuItem
							onSelect={() => setDialog({ status: "drive" })}
							renderIcon={(iconRef) => (
								<BrandGoogleIcon
									ref={iconRef}
									size={16}
									aria-hidden
									className="shrink-0 text-current"
								/>
							)}>
							Google Drive folders
						</AnimatedDropdownMenuItem>
						{canManageDeliverables ? (
							<>
								<AnimatedDropdownMenuItem
									className="hover:text-primary hover:[&_svg]:text-primary focus:text-primary focus:[&_svg]:text-primary"
									disabled={session.editStatus === "editing"}
									onSelect={() => void handleStatusChange("editing")}
									renderIcon={(iconRef) => (
										<KeyframesIcon
											ref={iconRef}
											size={16}
											aria-hidden
											className="shrink-0 text-current"
										/>
									)}>
									{session.editStatus === "completed" ? "Set status to editing" : "Start editing"}
								</AnimatedDropdownMenuItem>
								<AnimatedDropdownMenuItem
									className="hover:text-green focus:text-green"
									disabled={session.editStatus === "review"}
									onSelect={() => setDialog({ status: "review" })}
									renderIcon={(iconRef) => (
										<CheckedIcon
											ref={iconRef}
											size={16}
											aria-hidden
											className="shrink-0 text-current"
										/>
									)}>
									Ready to review
								</AnimatedDropdownMenuItem>
							</>
						) : null}
						<AnimatedDropdownMenuItem
							className="hover:[&_svg]:text-accent-foreground focus:[&_svg]:text-accent-foreground"
							onSelect={() => setDialog({ status: "notes" })}
							renderIcon={(iconRef) => (
								<PenIcon
									ref={iconRef}
									size={16}
									aria-hidden
									className="shrink-0 text-current"
								/>
							)}>
							Write editor notes
						</AnimatedDropdownMenuItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>
			<EditorDriveFoldersDialog
				session={session}
				open={dialog.status === "drive"}
				onOpenChange={(open) => setDialog({ status: open ? "drive" : "closed" })}
			/>
			{dialog.status === "notes" ? (
				<SessionEditorNotesDialog
					bookingId={session._id}
					bookingName={session.name}
					savedNotes={session.editorNotes}
					open
					onOpenChange={(open) => {
						if (!open) setDialog({ status: "closed" });
					}}
				/>
			) : null}
			<DeliverablesReviewDialog
				open={dialog.status === "review"}
				bookingId={session._id}
				driveLink={driveLink}
				clientNotes={clientNotes}
				isSubmitting={isUpdating}
				onDriveLinkChange={setDriveLink}
				onClientNotesChange={setClientNotes}
				onOpenChange={(open) => setDialog({ status: open ? "review" : "closed" })}
				onSubmit={() => void handleSubmitForReview()}
			/>
		</>
	);
}
