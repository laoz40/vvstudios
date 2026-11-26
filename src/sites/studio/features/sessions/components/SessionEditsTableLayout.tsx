import type { ReactNode } from "react";
import {
	Table,
	TableBody,
	TableCaption,
	TableHead,
	TableHeader,
	TableRow
} from "#/components/ui/table";

export function SessionEditsTableLayout({
	sessionName,
	afterDue,
	children
}: {
	sessionName: string;
	afterDue: ReactNode;
	children: ReactNode;
}) {
	return (
		<Table className="table-fixed">
			<TableCaption className="sr-only">Edits for {sessionName}</TableCaption>
			<TableHeader>
				<TableRow>
					<TableHead className="w-56">Status</TableHead>
					<TableHead className="w-64">Edit</TableHead>
					<TableHead className="w-36">Due</TableHead>
					{afterDue}
				</TableRow>
			</TableHeader>
			<TableBody>{children}</TableBody>
		</Table>
	);
}
