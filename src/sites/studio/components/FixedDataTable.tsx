import type { ReactNode } from "react";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "#/components/ui/table";
import { cn } from "#/lib/utils";

type FixedDataTableColumn = {
	key: string;
	colClassName: string;
	header: ReactNode;
	headerClassName?: string;
};

type FixedDataTableProps = {
	children: ReactNode;
	columns: FixedDataTableColumn[];
	minWidthClassName: string;
};

export function FixedDataTable({ children, columns, minWidthClassName }: FixedDataTableProps) {
	return (
		<Table className={cn("w-full table-fixed", minWidthClassName)}>
			<colgroup>
				{columns.map((column) => (
					<col
						key={column.key}
						className={column.colClassName}
					/>
				))}
			</colgroup>
			<TableHeader>
				<TableRow>
					{columns.map((column) => (
						<TableHead
							key={column.key}
							className={column.headerClassName}>
							{column.header}
						</TableHead>
					))}
				</TableRow>
			</TableHeader>
			<TableBody>{children}</TableBody>
		</Table>
	);
}
