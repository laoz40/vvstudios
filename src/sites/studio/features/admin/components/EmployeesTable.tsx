import { useRef, useState } from "react";
import {
	CheckIcon,
	LoaderCircleIcon,
	MoreHorizontalIcon,
	NotebookPenIcon,
	UserRoundPlusIcon,
	UserRoundXIcon
} from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { exhaustiveCheck, tryCatch, type UnexpectedError } from "#/lib/result";
import { Badge } from "#/components/ui/badge";
import MailFilledIcon from "#/components/ui/mail-filled-icon";
import type { AnimatedIconHandle } from "#/components/ui/types";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger
} from "#/components/ui/dropdown-menu";
import { Switch } from "#/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "#/components/ui/table";
import { api } from "#convex/_generated/api";
import { EditorNotesDialog } from "#studio/features/admin/components/EditorNotesDialog";
import { InviteUserDialog } from "#studio/features/admin/components/InviteUserDialog";
import { PrivacySensitiveText } from "#studio/features/admin/components/PrivacySensitiveText";
import {
	editorWorkStatusBadgeClassNames,
	editorWorkStatusLabels,
	formatLastAssignedAt,
	getEditorAccessErrorMessage,
	type AdminEditorProfile,
	type ManagedEditor
} from "#studio/features/admin/lib/editor-management";

type EmployeesTableProps = {
	adminEditorProfile: AdminEditorProfile | null;
	editors: ManagedEditor[];
};
type NotesDialogState = { status: "closed" } | { status: "open"; editor: ManagedEditor };
type EnrollAdminAsEditorError =
	| { reason: "EDITOR_PROFILE_INACTIVE" }
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
	| UnexpectedError;

function showEnrollAdminAsEditorError(error: EnrollAdminAsEditorError) {
	const reason = error.reason;
	switch (reason) {
		case "EDITOR_PROFILE_INACTIVE":
			toast.error("Your editor profile is retired. Reactivate it from the employees table.");
			return;
		case "NOT_AUTHENTICATED":
			toast.error("Your session has expired. Sign in again.");
			return;
		case "NOT_AUTHORIZED":
			toast.error("Only admins can enroll as editors.");
			return;
		case "UNEXPECTED_ERROR":
			toast.error("Unable to enroll as an editor.");
			return;
		default:
			exhaustiveCheck(reason);
	}
}

export function EmployeesTable({ adminEditorProfile, editors }: EmployeesTableProps) {
	const enrollAdminAsEditor = useMutation(api.auth.enrollAdminAsEditor);
	const updateEmployeeAccess = useMutation(api.employees.updateEmployeeAccess);
	const [showRetired, setShowRetired] = useState(false);
	const [openActionsEditorToken, setOpenActionsEditorToken] = useState<string | null>(null);
	const [updatingEditorToken, setUpdatingEditorToken] = useState<string | null>(null);
	const [isEnrolling, setIsEnrolling] = useState(false);
	const [notesDialog, setNotesDialog] = useState<NotesDialogState>({ status: "closed" });
	const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
	const inviteIconRef = useRef<AnimatedIconHandle | null>(null);
	const visibleEditors = editors.filter((editor) => editor.isActive !== showRetired);

	async function handleEnrollAsEditor() {
		setIsEnrolling(true);
		const [error] = await tryCatch(enrollAdminAsEditor({}));
		setIsEnrolling(false);

		if (error !== null) {
			showEnrollAdminAsEditorError(error);
			return;
		}

		toast.success("You can now assign yourself to edit sessions.");
	}

	async function handleAccessChange(editor: ManagedEditor) {
		setUpdatingEditorToken(editor.tokenIdentifier);
		const [error] = await tryCatch(
			updateEmployeeAccess({ tokenIdentifier: editor.tokenIdentifier, isActive: !editor.isActive })
		);
		setUpdatingEditorToken(null);
		setOpenActionsEditorToken(null);

		if (error !== null) {
			toast.error(getEditorAccessErrorMessage(error.reason));
			return;
		}

		toast.success(editor.isActive ? "Employee retired" : "Employee reactivated");
	}

	return (
		<>
			<section className="flex flex-col gap-4">
				<div className="flex items-center justify-between gap-4">
					<div className="flex flex-wrap items-center gap-2">
						<Button
							variant="outline"
							onClick={() => setIsInviteDialogOpen(true)}
							onPointerEnter={() => inviteIconRef.current?.startAnimation()}
							onPointerLeave={() => inviteIconRef.current?.stopAnimation()}
							onFocus={() => inviteIconRef.current?.startAnimation()}
							onBlur={() => inviteIconRef.current?.stopAnimation()}>
							<MailFilledIcon
								ref={inviteIconRef}
								size={16}
								aria-hidden
							/>
							Invite editor
						</Button>
						{adminEditorProfile === null ? (
							<Button
								variant="outline"
								disabled={isEnrolling}
								onClick={() => void handleEnrollAsEditor()}>
								{isEnrolling ? (
									<>
										<LoaderCircleIcon className="animate-spin" />
										Enrolling
									</>
								) : (
									<>
										<UserRoundPlusIcon />
										Add yourself as editor
									</>
								)}
							</Button>
						) : null}
					</div>
					<div className="flex items-center justify-end gap-2">
						<label
							htmlFor="show-retired-employees"
							className="text-sm text-muted-foreground">
							Show retired
						</label>
						<Switch
							id="show-retired-employees"
							checked={showRetired}
							onCheckedChange={setShowRetired}
						/>
					</div>
				</div>

				<div className="overflow-x-auto border-y">
					<Table className="w-full min-w-5xl table-fixed">
						<colgroup>
							<col className="w-20 md:w-12" />
							<col className="w-40 md:w-32" />
							<col className="w-54 md:w-42" />
							<col className="w-24" />
							<col className="w-20" />
							<col className="w-64" />
							<col className="w-6" />
						</colgroup>
						<TableHeader>
							<TableRow>
								<TableHead>Work status</TableHead>
								<TableHead>Name</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Last assigned</TableHead>
								<TableHead>Total edits</TableHead>
								<TableHead>Notes</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{visibleEditors.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={7}
										className="h-24 text-center text-muted-foreground">
										No employees to show.
									</TableCell>
								</TableRow>
							) : (
								visibleEditors.map((editor) => {
									const isUpdatingThisEditor = updatingEditorToken === editor.tokenIdentifier;
									let accessActionIcon = editor.isActive ? <UserRoundXIcon /> : <CheckIcon />;
									let accessActionLabel = editor.isActive
										? "Retire employee"
										: "Reactivate employee";

									if (isUpdatingThisEditor) {
										accessActionIcon = <LoaderCircleIcon className="animate-spin" />;
										accessActionLabel = editor.isActive ? "Retiring" : "Reactivating";
									}

									return (
										<TableRow key={editor.tokenIdentifier}>
											<TableCell>
												<Badge className={editorWorkStatusBadgeClassNames[editor.workStatus]}>
													{editorWorkStatusLabels[editor.workStatus]}
												</Badge>
											</TableCell>
											<TableCell className="font-medium">
												<PrivacySensitiveText
													rowId={editor.tokenIdentifier}
													value={editor.displayName || "Unnamed employee"}
													label="employee name"
													copyable={false}>
													{editor.displayName || "Unnamed employee"}
												</PrivacySensitiveText>
											</TableCell>
											<TableCell>
												<PrivacySensitiveText
													rowId={editor.tokenIdentifier}
													value={editor.email}
													label="email"
													copyable={false}>
													{editor.email}
												</PrivacySensitiveText>
											</TableCell>
											<TableCell>{formatLastAssignedAt(editor.lastAssignedAt)}</TableCell>
											<TableCell>{editor.totalEdits}</TableCell>
											<TableCell
												className="truncate text-muted-foreground"
												title={editor.notes}>
												{editor.notes || "-"}
											</TableCell>
											<TableCell>
												<DropdownMenu
													modal={false}
													open={openActionsEditorToken === editor.tokenIdentifier}
													onOpenChange={(open) => {
														if (isUpdatingThisEditor) return;
														setOpenActionsEditorToken(open ? editor.tokenIdentifier : null);
													}}>
													<DropdownMenuTrigger asChild>
														<Button
															variant="ghost"
															size="icon-sm"
															disabled={updatingEditorToken !== null}>
															<span className="sr-only">Open employee actions</span>
															<MoreHorizontalIcon aria-hidden />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuGroup>
															<DropdownMenuItem
																className="cursor-pointer"
																disabled={isUpdatingThisEditor}
																onSelect={() => setNotesDialog({ status: "open", editor })}>
																<NotebookPenIcon />
																Edit notes
															</DropdownMenuItem>
															<DropdownMenuItem
																variant={editor.isActive ? "destructive" : "default"}
																className="cursor-pointer"
																disabled={isUpdatingThisEditor}
																onSelect={(event) => {
																	event.preventDefault();
																	void handleAccessChange(editor);
																}}>
																{accessActionIcon}
																{accessActionLabel}
															</DropdownMenuItem>
														</DropdownMenuGroup>
													</DropdownMenuContent>
												</DropdownMenu>
											</TableCell>
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</div>
			</section>
			{notesDialog.status === "open" ? (
				<EditorNotesDialog
					editor={notesDialog.editor}
					open
					onOpenChange={(open) => {
						if (!open) setNotesDialog({ status: "closed" });
					}}
				/>
			) : null}
			<InviteUserDialog
				open={isInviteDialogOpen}
				onOpenChange={setIsInviteDialogOpen}
			/>
		</>
	);
}
