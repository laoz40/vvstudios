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
import MailFilledIcon from "#/components/ui/mail-filled-icon";
import PenIcon from "#/components/ui/pen-icon";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import { AnimatedDropdownMenuItem } from "#studio/features/admin/components/AnimatedDropdownMenuItem";
import { deliverableStatusLabelMap } from "#studio/features/admin/lib/session-edit-status";

type EditorSession = FunctionReturnType<typeof api.sessions.listEditorSessions>["page"][number];

export function EditorDeliverablesActions({ session }: { session: EditorSession }) {
	const updateSessionEditStatus = useMutation(api.sessions.updateSessionEditStatus);
	const [isUpdating, setIsUpdating] = useState(false);

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
						className="hover:text-primary focus:text-primary"
						disabled={session.editStatus === "editing"}
						onSelect={() => void handleStatusChange("editing")}
						renderIcon={(iconRef) => (
							<PenIcon
								ref={iconRef}
								size={16}
								aria-hidden
								className="shrink-0 text-current"
							/>
						)}>
						Set editing
					</AnimatedDropdownMenuItem>
					<AnimatedDropdownMenuItem
						className="hover:text-green focus:text-green"
						disabled={session.editStatus === "completed"}
						onSelect={() => void handleStatusChange("completed")}
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
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
