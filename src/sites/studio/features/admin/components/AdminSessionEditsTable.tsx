import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { TableCell, TableHead, TableRow } from "#/components/ui/table";
import { tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import { DeliverablesEmailDialog } from "#studio/features/admin/components/DeliverablesEmailDialog";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import { deliverablesEmailErrorToast } from "#studio/features/editor/lib/deliverables-email-errors";
import { SessionEditsTableLayout } from "#studio/features/sessions/components/SessionEditsTableLayout";
import { EditStatusBadge } from "#studio/features/sessions/components/EditStatusBadge";
import {
	formatDriveSessionMediaFolderName,
	formatShortMonthFullDate,
	getBookingStartTimestamp,
	getEditorEditDueAt
} from "#studio/lib/bookingdatetime";

type SessionEdit = NonNullable<SessionRecord["edits"]>[number];

function SendEditDialog({
	session,
	edit,
	onClose
}: {
	session: SessionRecord;
	edit: SessionEdit;
	onClose: () => void;
}) {
	const [notes, setNotes] = useState("");
	const [isSending, setIsSending] = useState(false);
	const sendEditToClient = useAction(api.editor.deliverablesEmail.sendEditToClient);
	const driveStatus = useQuery(api.sessions.admin.getDriveStatus, { bookingId: session._id });
	const folder = driveStatus?.[1]?.folders?.find((item) => item.name === "Deliverables");

	async function send() {
		setIsSending(true);

		const [error] = await tryCatch(
			sendEditToClient({
				bookingId: session._id,
				editId: edit._id,
				notes: notes.trim() || undefined
			})
		);

		if (error !== null) {
			setIsSending(false);
			toast.error(deliverablesEmailErrorToast(error.reason));

			return;
		}

		toast.success(`${edit.label} sent to ${session.name}.`);
		onClose();
	}

	return (
		<DeliverablesEmailDialog
			open
			bookingId={session._id}
			bookingName={session.name}
			recipient={{ visibility: "shown", email: session.email }}
			outcome={{ kind: "edit", label: edit.label }}
			deliverablesFolderName={formatDriveSessionMediaFolderName(
				"Deliverables",
				getBookingStartTimestamp(session.date, session.time)
			)}
			deliverablesFolderUrl={folder?.url}
			isFolderStatusLoading={driveStatus === undefined}
			isSending={isSending}
			editorNotes={notes}
			onEditorNotesChange={setNotes}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			onSend={() => void send()}
		/>
	);
}

export function AdminSessionEditsTable({
	session,
	edits,
	canSend
}: {
	session: SessionRecord;
	edits: SessionEdit[];
	canSend: boolean;
}) {
	const [selectedEdit, setSelectedEdit] = useState<SessionEdit | null>(null);

	const dueDate = formatShortMonthFullDate(
		getEditorEditDueAt(getBookingStartTimestamp(session.date, session.time), session.editorDueDate)
	);

	return (
		<>
			<SessionEditsTableLayout
				sessionName={session.name}
				afterDue={
					canSend ? (
						<TableHead>
							<span className="sr-only">Actions</span>
						</TableHead>
					) : null
				}>
				{edits.map((edit) => (
					<TableRow key={edit._id}>
						<TableCell className="font-medium whitespace-normal">{edit.label}</TableCell>
						<TableCell>
							<EditStatusBadge status={edit.status} />
						</TableCell>
						<TableCell className="text-muted-foreground">{dueDate}</TableCell>
						{canSend ? (
							<TableCell className="text-right">
								<Button
									type="button"
									size="xs"
									variant="outline"
									disabled={edit.status === "revision_requested"}
									title={
										edit.status === "revision_requested"
											? "Initial delivery is locked while a revision request is open."
											: undefined
									}
									aria-label={`Send deliverables for ${edit.label}`}
									onClick={() => setSelectedEdit(edit)}>
									Send deliverables
								</Button>
							</TableCell>
						) : null}
					</TableRow>
				))}
			</SessionEditsTableLayout>
			{selectedEdit ? (
				<SendEditDialog
					session={session}
					edit={selectedEdit}
					onClose={() => setSelectedEdit(null)}
				/>
			) : null}
		</>
	);
}
