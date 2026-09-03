import { useState } from "react";
import {
	CheckIcon,
	LoaderCircleIcon,
	MoreHorizontalIcon,
	NotebookPenIcon,
	UserRoundXIcon
} from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { tryCatch } from "#/lib/result";
import { Badge } from "#/components/ui/badge";
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
import {
	editorWorkStatusBadgeClassNames,
	editorWorkStatusLabels,
	formatLastAssignedAt,
	getEditorAccessErrorMessage,
	type ManagedEditor
} from "#studio/features/admin/lib/editor-management";

type EmployeesTableProps = { editors: ManagedEditor[] };
type NotesDialogState = { status: "closed" } | { status: "open"; editor: ManagedEditor };

export function EmployeesTable({ editors }: EmployeesTableProps) {
	const updateEmployeeAccess = useMutation(api.employees.updateEmployeeAccess);
	const [showRetired, setShowRetired] = useState(false);
	const [openActionsEditorToken, setOpenActionsEditorToken] = useState<string | null>(null);
	const [updatingEditorToken, setUpdatingEditorToken] = useState<string | null>(null);
	const [notesDialog, setNotesDialog] = useState<NotesDialogState>({ status: "closed" });
	const visibleEditors = editors.filter((editor) => editor.isActive !== showRetired);

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
												{editor.displayName || "Unnamed employee"}
											</TableCell>
											<TableCell>{editor.email}</TableCell>
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
		</>
	);
}
