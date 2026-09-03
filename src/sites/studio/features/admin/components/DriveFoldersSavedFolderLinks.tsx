import { ExternalLink, Folder, FolderOpen, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import type { DriveDialogStatus } from "#studio/features/admin/lib/drive-folders-dialog";

function getSessionChildFolderName({
	folderName,
	rawMediaFolderName,
	deliverablesFolderName
}: {
	folderName: string;
	rawMediaFolderName: string;
	deliverablesFolderName: string;
}) {
	switch (folderName) {
		case "Raw Media":
			return rawMediaFolderName;
		case "Deliverables":
			return deliverablesFolderName;
		default:
			return folderName;
	}
}

function FolderLink({
	url,
	label,
	icon: Icon,
	variant,
	className,
	fallback
}: {
	url: string | undefined;
	label: string;
	icon: LucideIcon;
	variant: "outline" | "secondary";
	className: string;
	fallback: ReactNode;
}) {
	if (!url) return fallback;

	return (
		<Button
			variant={variant}
			className={className}
			asChild>
			<a
				href={url}
				target="_blank"
				rel="noreferrer">
				<Icon
					data-icon="inline-start"
					aria-hidden
				/>
				{label}
				<ExternalLink
					data-icon="inline-end"
					aria-hidden
				/>
			</a>
		</Button>
	);
}

function NotCreatedFolderRow() {
	return (
		<div className="flex h-9 items-center gap-2 rounded-md border border-dashed px-3 text-sm text-muted-foreground">
			<Folder
				className="size-4"
				aria-hidden
			/>
			Not created
		</div>
	);
}

export function SavedFolderLinks({
	folders,
	sessionFolderName,
	packageFolderName,
	rawMediaFolderName,
	deliverablesFolderName
}: {
	folders: NonNullable<DriveDialogStatus["folders"]>;
	sessionFolderName: string;
	packageFolderName: string | undefined;
	rawMediaFolderName: string;
	deliverablesFolderName: string;
}) {
	const assetsFolder = folders.find((folder) => folder.name === "Assets");
	const packageFolder = folders.find((folder) => folder.name === "Package");
	const sessionFolder = folders.find((folder) => folder.name === "Session");
	const sessionChildFolders = folders.filter(
		(folder) => folder.name !== "Session" && folder.name !== "Assets" && folder.name !== "Package"
	);

	if (folders.length === 0) return null;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col gap-2">
				<p className="text-sm font-medium">Client assets library</p>
				<FolderLink
					url={assetsFolder?.url}
					label="_Assets"
					icon={FolderOpen}
					variant="outline"
					className="w-full justify-start"
					fallback={<NotCreatedFolderRow />}
				/>
			</div>

			{packageFolderName !== undefined ? (
				<div className="flex flex-col gap-2">
					<p className="text-sm font-medium">Package folder</p>
					<FolderLink
						url={packageFolder?.url}
						label={packageFolderName}
						icon={FolderOpen}
						variant="outline"
						className="w-full justify-start"
						fallback={<NotCreatedFolderRow />}
					/>
				</div>
			) : null}

			<div className="flex flex-col gap-2">
				<p className="text-sm font-medium">Session folders</p>
				<FolderLink
					url={sessionFolder?.url}
					label={sessionFolderName}
					icon={FolderOpen}
					variant="outline"
					className="w-full justify-start"
					fallback={<NotCreatedFolderRow />}
				/>

				{sessionChildFolders.length > 0 ? (
					<div className="ml-3 flex flex-col gap-2 border-l pl-3">
						{sessionChildFolders.map((folder) => {
							const folderName = getSessionChildFolderName({
								folderName: folder.name,
								rawMediaFolderName,
								deliverablesFolderName
							});
							return (
								<FolderLink
									key={folder.name}
									url={folder.url}
									label={folderName}
									icon={Folder}
									variant="secondary"
									className="justify-start"
									fallback={
										<p className="text-sm text-muted-foreground">{folderName}: not created</p>
									}
								/>
							);
						})}
					</div>
				) : null}
			</div>
		</div>
	);
}
