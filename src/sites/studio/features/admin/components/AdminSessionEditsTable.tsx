import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "#/components/ui/table";
import { tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import { DeliverablesEmailDialog } from "#studio/features/admin/components/DeliverablesEmailDialog";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import { deliverablesEmailErrorToast } from "#studio/features/editor/lib/deliverables-email-errors";
import { editStatuses } from "#studio/features/sessions/lib/edit-status-display";
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
			<Table>
				<TableCaption className="sr-only">Edits for {session.name}</TableCaption>
				<TableHeader>
					<TableRow>
						<TableHead className="w-40">Status</TableHead>
						<TableHead>Edit</TableHead>
						<TableHead className="w-32">Due</TableHead>
						{canSend ? (
							<TableHead className="w-40">
								<span className="sr-only">Actions</span>
							</TableHead>
						) : null}
					</TableRow>
				</TableHeader>
				<TableBody>
					{edits.map((edit) => {
						const { label, className } = editStatuses[edit.status];

						return (
							<TableRow key={edit._id}>
								<TableCell>
									<Badge className={className}>{label}</Badge>
								</TableCell>
								<TableCell className="font-medium whitespace-normal">{edit.label}</TableCell>
								<TableCell className="text-muted-foreground">{dueDate}</TableCell>
								{canSend ? (
									<TableCell className="text-right">
										<Button
											type="button"
											size="sm"
											variant="outline"
											aria-label={`Send deliverables for ${edit.label}`}
											onClick={() => setSelectedEdit(edit)}>
											Send deliverables
										</Button>
									</TableCell>
								) : null}
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
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
