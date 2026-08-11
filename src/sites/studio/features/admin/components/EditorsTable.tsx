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

type EditorsTableProps = { editors: ManagedEditor[] };
type NotesDialogState = { status: "closed" } | { status: "open"; editor: ManagedEditor };

export function EditorsTable({ editors }: EditorsTableProps) {
	const updateEditorAccess = useMutation(api.editors.updateEditorAccess);
	const [showRetired, setShowRetired] = useState(false);
	const [isUpdatingAccess, setIsUpdatingAccess] = useState(false);
	const [notesDialog, setNotesDialog] = useState<NotesDialogState>({ status: "closed" });
	const visibleEditors = editors.filter((editor) => editor.isActive !== showRetired);

	async function handleAccessChange(editor: ManagedEditor) {
		setIsUpdatingAccess(true);
		const [error] = await tryCatch(
			updateEditorAccess({ tokenIdentifier: editor.tokenIdentifier, isActive: !editor.isActive })
		);
		setIsUpdatingAccess(false);

		if (error !== null) {
			toast.error(getEditorAccessErrorMessage(error.reason));
			return;
		}

		toast.success(editor.isActive ? "Editor retired" : "Editor reactivated");
	}

	return (
		<>
			<section className="flex flex-col gap-4">
				<div className="flex items-center justify-end gap-2">
					<label
						htmlFor="show-retired-editors"
						className="text-sm text-muted-foreground">
						Show retired
					</label>
					<Switch
						id="show-retired-editors"
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
							<col className="w-64" />
							<col className="w-6" />
						</colgroup>
						<TableHeader>
							<TableRow>
								<TableHead>Work status</TableHead>
								<TableHead>Name</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Last assigned</TableHead>
								<TableHead>Notes</TableHead>
								<TableHead />
							</TableRow>
						</TableHeader>
						<TableBody>
							{visibleEditors.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="h-24 text-center text-muted-foreground">
										No editors to show.
									</TableCell>
								</TableRow>
							) : (
								visibleEditors.map((editor) => {
									return (
										<TableRow key={editor.tokenIdentifier}>
											<TableCell>
												<Badge className={editorWorkStatusBadgeClassNames[editor.workStatus]}>
													{editorWorkStatusLabels[editor.workStatus]}
												</Badge>
											</TableCell>
											<TableCell className="font-medium">
												{editor.displayName || "Unnamed editor"}
											</TableCell>
											<TableCell>{editor.email}</TableCell>
											<TableCell>{formatLastAssignedAt(editor.lastAssignedAt)}</TableCell>
											<TableCell
												className="truncate text-muted-foreground"
												title={editor.notes}>
												{editor.notes || "-"}
											</TableCell>
											<TableCell>
												<DropdownMenu modal={false}>
													<DropdownMenuTrigger asChild>
														<Button
															variant="ghost"
															size="icon-sm"
															disabled={isUpdatingAccess}>
															<span className="sr-only">Open editor actions</span>
															{isUpdatingAccess ? (
																<LoaderCircleIcon
																	className="animate-spin"
																	aria-hidden
																/>
															) : (
																<MoreHorizontalIcon aria-hidden />
															)}
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuGroup>
															<DropdownMenuItem
																className="cursor-pointer"
																onSelect={() => setNotesDialog({ status: "open", editor })}>
																<NotebookPenIcon />
																Edit notes
															</DropdownMenuItem>
															<DropdownMenuItem
																variant={editor.isActive ? "destructive" : "default"}
																className="cursor-pointer"
																onSelect={() => void handleAccessChange(editor)}>
																{editor.isActive ? <UserRoundXIcon /> : <CheckIcon />}
																{editor.isActive ? "Retire editor" : "Reactivate editor"}
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
