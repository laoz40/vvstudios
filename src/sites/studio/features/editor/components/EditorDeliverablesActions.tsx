import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
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
import KeyframesIcon from "#/components/ui/keyframes-icon";
import MailFilledIcon from "#/components/ui/mail-filled-icon";
import PenIcon from "#/components/ui/pen-icon";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import { AnimatedDropdownMenuItem } from "#studio/features/admin/components/AnimatedDropdownMenuItem";
import { DeliverablesEmailDialog } from "#studio/features/admin/components/DeliverablesEmailDialog";
import { SessionNotesDialog } from "#studio/features/admin/components/SessionNotesDialog";
import { deliverableStatusLabelMap } from "#studio/features/admin/lib/session-edit-status";
import { useEditorDeliverablesEmailAction } from "#studio/features/editor/hooks/useEditorDeliverablesEmailAction";

type EditorSession = FunctionReturnType<typeof api.sessions.listEditorSessions>["page"][number];
type NotesDialogState = { status: "closed" } | { status: "open" };

export function EditorDeliverablesActions({
	session,
	canManageDeliverables
}: {
	session: EditorSession;
	canManageDeliverables: boolean;
}) {
	const updateSessionEditStatus = useMutation(api.sessions.updateSessionEditStatus);
	const emailAction = useEditorDeliverablesEmailAction(session);
	const [isUpdating, setIsUpdating] = useState(false);
	const [notesDialog, setNotesDialog] = useState<NotesDialogState>({ status: "closed" });

	async function handleStatusChange(editStatus: "editing" | "completed") {
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
									Start editing
								</AnimatedDropdownMenuItem>
								<AnimatedDropdownMenuItem
									className="hover:text-green focus:text-green"
									disabled={emailAction.isSending}
									onSelect={() => emailAction.setIsOpen(true)}
									renderIcon={(iconRef) => (
										<MailFilledIcon
											ref={iconRef}
											size={16}
											aria-hidden
											className="shrink-0 text-current"
										/>
									)}>
									Email deliverables
								</AnimatedDropdownMenuItem>
							</>
						) : null}
						<AnimatedDropdownMenuItem
							className="hover:[&_svg]:text-accent-foreground focus:[&_svg]:text-accent-foreground"
							onSelect={() => setNotesDialog({ status: "open" })}
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
			{notesDialog.status === "open" ? (
				<SessionNotesDialog
					bookingId={session._id}
					bookingName={session.name}
					savedNotes={session.editorNotes}
					open
					onOpenChange={(open) => {
						if (!open) setNotesDialog({ status: "closed" });
					}}
				/>
			) : null}
			<DeliverablesEmailDialog
				open={emailAction.isOpen}
				bookingId={session._id}
				bookingName={session.name}
				recipient={{ visibility: "hidden" }}
				driveLink={emailAction.driveLink}
				editorNotes={emailAction.editorNotes}
				emailVariant={emailAction.emailVariant}
				isCustomerTypeLoading={emailAction.isCustomerTypeLoading}
				isSending={emailAction.isSending}
				markAsSentAfterSending={emailAction.markAsSent}
				showCustomerType={false}
				onDriveLinkChange={emailAction.setDriveLink}
				onEditorNotesChange={emailAction.setEditorNotes}
				onEmailVariantChange={emailAction.setEmailVariant}
				onMarkAsSentAfterSendingChange={emailAction.setMarkAsSent}
				onOpenChange={emailAction.setIsOpen}
				onSend={() => void emailAction.sendDeliverablesEmail()}
			/>
		</>
	);
}
