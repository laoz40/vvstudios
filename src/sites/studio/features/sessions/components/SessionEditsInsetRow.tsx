import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { TableCell, TableRow } from "#/components/ui/table";

export function SessionEditsInsetRow({
	id,
	colSpan,
	isExpanded,
	children
}: {
	id: string;
	colSpan: number;
	isExpanded: boolean;
	children: ReactNode;
}) {
	const reduceMotion = useReducedMotion();

	return (
		<TableRow
			id={id}
			data-session-edits=""
			aria-hidden={!isExpanded}
			inert={!isExpanded}
			className="border-0 bg-background hover:bg-background has-[+tr]:[&_[data-inset]]:after:block aria-[hidden=false]:[&+tr>td]:border-t aria-[hidden=false]:[&+tr>td]:border-t-foreground/30">
			<TableCell
				colSpan={colSpan}
				className="p-0">
				<AnimatePresence initial={false}>
					{isExpanded ? (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeIn" }}
							className="overflow-hidden">
							<div
								data-inset=""
								className="relative bg-muted/50 px-3 pt-1 pb-2 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1.5 before:bg-linear-to-b before:from-(--shadow-color)/45 before:to-transparent after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-10 after:hidden after:h-1.5 after:bg-linear-to-t after:from-(--shadow-color)/40 after:to-transparent">
								{children}
							</div>
						</motion.div>
					) : null}
				</AnimatePresence>
			</TableCell>
		</TableRow>
	);
}
