import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { useMutation } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "#/components/ui/select";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";

export type ActiveEditor = FunctionReturnType<typeof api.sessions.listActiveEditors>[number];
type SessionEditorAssignmentProps = { activeEditors: ActiveEditor[]; session: SessionRecord };

const UNASSIGNED_VALUE = "__unassigned__";

export function SessionEditorAssignment({ activeEditors, session }: SessionEditorAssignmentProps) {
	const assignSessionEditor = useMutation(api.sessions.assignSessionEditor);
	const [isSaving, setIsSaving] = useState(false);

	async function updateAssignment(selectedValue: string) {
		setIsSaving(true);
		const editorTokenIdentifier = selectedValue === UNASSIGNED_VALUE ? null : selectedValue;
		const [error] = await tryCatch(
			assignSessionEditor({ bookingId: session._id, editorTokenIdentifier })
		);
		setIsSaving(false);

		if (error === null) {
			toast.success(editorTokenIdentifier === null ? "Editor unassigned." : "Editor assigned.");
			return;
		}

		switch (error.reason) {
			case "BOOKING_NOT_FOUND":
				toast.error("This session no longer exists.");
				return;
			case "EDITOR_NOT_ACTIVE":
				toast.error("That editor is no longer active.");
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
			default: {
				const _exhaustive: never = error;
				void _exhaustive;
				return;
			}
		}
	}

	return (
		<Select
			value={session.assignedEditorTokenIdentifier ?? UNASSIGNED_VALUE}
			disabled={isSaving}
			onValueChange={(selectedValue) => void updateAssignment(selectedValue)}>
			<SelectTrigger
				size="sm"
				className="w-full bg-background/60 dark:bg-background/60 dark:hover:bg-background/60"
				aria-label={`Editor assigned to ${session.name}`}>
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
