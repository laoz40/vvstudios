import type { FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "#/components/ui/select";
import { api } from "#convex/_generated/api";
import { Field, FieldLabel } from "#/components/ui/field";
import { Textarea } from "#/components/ui/textarea";
import { exhaustiveCheck, tryCatch, type UnexpectedError } from "#/lib/result";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";

type ActiveEditor = FunctionReturnType<typeof api.sessions.listActiveEditors>[number];

type SessionEditorAssignmentProps = { isMenuOpen: boolean; session: SessionRecord };

type AssignmentConfirmation =
	| { status: "closed" }
	| { status: "open"; nextEditor: ActiveEditor | null };

type AssignmentError =
	| NonNullable<FunctionReturnType<typeof api.sessions.assignSessionEditor>[0]>
	| UnexpectedError;

const UNASSIGNED_VALUE = "__unassigned__";

function showAssignmentError(error: AssignmentError) {
	const reason = error.reason;

	switch (reason) {
		case "BOOKING_NOT_FOUND":
			toast.error("This session no longer exists.");

			return;
		case "EDITOR_NOT_ACTIVE":
			toast.error("That editor is no longer active.");

			return;
		case "SESSION_NOT_ASSIGNABLE":
			toast.error("Editors can only be assigned to confirmed, non-archived sessions.");

			return;
		case "NOT_AUTHENTICATED":
			toast.error("Please sign in again.");

			return;
		case "NOT_AUTHORIZED":
			toast.error("You do not have permission to assign editors.");

			return;
		case "UNEXPECTED_ERROR":
			toast.error("Unable to update the editor assignment.");

			return;
		default:
			exhaustiveCheck(reason);
	}
}

function EditorDetails({ editor, label }: { editor: ActiveEditor; label: string }) {
	const hasOtherEditJobs = editor.workStatus === "assigned" || editor.workStatus === "editing";

	return (
		<div className="flex flex-col gap-2 rounded-lg border p-3">
			<p className="text-sm font-medium">{label}</p>
			<div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
				<span className="text-muted-foreground">Name</span>
				<span>{editor.displayName || "Unnamed editor"}</span>
				<span className="text-muted-foreground">Email</span>
				<span className="break-all">{editor.email}</span>
				<span className="text-muted-foreground">Total edits</span>
				<span>{editor.totalEdits}</span>
				<span className="text-muted-foreground">Has other edits assigned</span>
				<span>{hasOtherEditJobs ? "Yes" : "No"}</span>
			</div>
		</div>
	);
}

type EditorSelectProps = {
	activeEditors: ActiveEditor[];
	assignedEditorDisplayName: string | null;
	isLoadingEditors: boolean;
	session: SessionRecord;
	isSaving: boolean;
	onSelect: (value: string) => void;
};

function EditorSelect({
	activeEditors,
	assignedEditorDisplayName,
	isLoadingEditors,
	session,
	isSaving,
	onSelect
}: EditorSelectProps) {
	const assignedEditorTokenIdentifier = session.assignedEditorTokenIdentifier;

	const assignedEditorMissingFromActiveList =
		assignedEditorTokenIdentifier !== undefined &&
		!activeEditors.some((editor) => editor.tokenIdentifier === assignedEditorTokenIdentifier);

	if (isLoadingEditors) {
		return (
			<div
				aria-busy="true"
				className="flex h-8 w-full items-center gap-2 rounded-md border border-input bg-background/60 px-3 text-sm text-muted-foreground opacity-50 dark:bg-background/60">
				<LoaderCircle className="animate-spin" />
				Loading editors
			</div>
		);
	}

	return (
		<Select
			value={assignedEditorTokenIdentifier ?? UNASSIGNED_VALUE}
			disabled={isSaving}
			onValueChange={onSelect}>
			<SelectTrigger
				size="sm"
				className="w-full bg-background/60 dark:bg-background/60 dark:hover:bg-background/60"
				aria-label={`Editor assigned to ${session.name}`}
				onPointerDown={(event) => {
					event.preventDefault();
				}}>
				{isSaving ? (
					<>
						<LoaderCircle className="animate-spin" />
						Assigning
					</>
				) : (
					<SelectValue placeholder="No editor assigned" />
				)}
			</SelectTrigger>
			<SelectContent className="bg-background">
				<SelectGroup>
					<SelectItem value={UNASSIGNED_VALUE}>No editor assigned</SelectItem>
					{assignedEditorMissingFromActiveList && assignedEditorDisplayName ? (
						<SelectItem value={assignedEditorTokenIdentifier}>
							{assignedEditorDisplayName}
						</SelectItem>
					) : null}
					{activeEditors.map((editor) => (
						<SelectItem
							key={editor.tokenIdentifier}
							value={editor.tokenIdentifier}>
							{editor.displayName || editor.email}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	);
}

export function SessionEditorAssignment({ isMenuOpen, session }: SessionEditorAssignmentProps) {
	const assignSessionEditor = useMutation(api.sessions.assignSessionEditor);
	const activeEditorsResult = useQuery(api.sessions.listActiveEditors, isMenuOpen ? {} : "skip");
	const activeEditors = activeEditorsResult ?? [];
	const isLoadingEditors = isMenuOpen && activeEditorsResult === undefined;
	const [isSaving, setIsSaving] = useState(false);
	const [adminNotes, setAdminNotes] = useState(session.adminNotes ?? "");
	const [confirmation, setConfirmation] = useState<AssignmentConfirmation>({ status: "closed" });

	const currentEditor = activeEditors.find(
		(editor) => editor.tokenIdentifier === session.assignedEditorTokenIdentifier
	);

	// Keep the draft current when notes are changed from the separate admin-notes action.
	useEffect(() => {
		setAdminNotes(session.adminNotes ?? "");
	}, [session.adminNotes]);

	function requestAssignment(selectedValue: string) {
		const nextEditor =
			selectedValue === UNASSIGNED_VALUE
				? null
				: (activeEditors.find((editor) => editor.tokenIdentifier === selectedValue) ?? null);

		if (selectedValue !== UNASSIGNED_VALUE && nextEditor === null) {
			toast.error("That editor is no longer available.");

			return;
		}

		setConfirmation({ status: "open", nextEditor });
	}

	async function confirmAssignment() {
		if (confirmation.status !== "open") return;

		setIsSaving(true);
		const editorTokenIdentifier = confirmation.nextEditor?.tokenIdentifier ?? null;

		const [error] = await tryCatch(
			assignSessionEditor({ bookingId: session._id, editorTokenIdentifier, adminNotes })
		);

		setIsSaving(false);

		if (error === null) {
			setConfirmation({ status: "closed" });
			toast.success(editorTokenIdentifier === null ? "Editor unassigned." : "Editor assigned.");

			return;
		}

		showAssignmentError(error);
	}

	const nextEditor = confirmation.status === "open" ? confirmation.nextEditor : null;
	const isReassignment = currentEditor !== undefined;
	let dialogTitle = "Assign editor?";

	if (isReassignment) dialogTitle = nextEditor === null ? "Unassign editor?" : "Reassign editor?";
	const confirmButtonLabel = nextEditor === null ? "Confirm unassignment" : "Confirm assignment";

	return (
		<>
			<EditorSelect
				activeEditors={activeEditors}
				assignedEditorDisplayName={session.assignedEditorDisplayName ?? null}
				isLoadingEditors={isLoadingEditors}
				session={session}
				isSaving={isSaving}
				onSelect={requestAssignment}
			/>

			<Dialog
				open={confirmation.status === "open"}
				onOpenChange={(open) => {
					if (!open && !isSaving) setConfirmation({ status: "closed" });
				}}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{dialogTitle}</DialogTitle>
						<DialogDescription>
							Review the assignment details before confirming this change.
						</DialogDescription>
					</DialogHeader>

					<div className="flex flex-col gap-3">
						{currentEditor ? (
							<EditorDetails
								editor={currentEditor}
								label="Currently assigned"
							/>
						) : null}
						{nextEditor ? (
							<EditorDetails
								editor={nextEditor}
								label={isReassignment ? "Switching to" : "Assigning"}
							/>
						) : (
							<p className="rounded-lg border p-3 text-sm text-muted-foreground">
								This session will have no editor assigned.
							</p>
						)}
						<Field>
							<FieldLabel htmlFor={`assignment-admin-notes-${session._id}`}>Admin notes</FieldLabel>
							<Textarea
								id={`assignment-admin-notes-${session._id}`}
								value={adminNotes}
								disabled={isSaving}
								placeholder="Add instructions for the editor..."
								onChange={(event) => setAdminNotes(event.target.value)}
							/>
						</Field>
					</div>

					<DialogFooter>
						<Button
							variant="outline"
							disabled={isSaving}
							onClick={() => setConfirmation({ status: "closed" })}>
							Cancel
						</Button>
						<Button
							variant={isReassignment ? "destructive" : "default"}
							disabled={isSaving}
							onClick={() => void confirmAssignment()}>
							{isSaving ? (
								<>
									<LoaderCircle
										data-icon="inline-start"
										className="animate-spin"
									/>
									Assigning
								</>
							) : (
								confirmButtonLabel
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
