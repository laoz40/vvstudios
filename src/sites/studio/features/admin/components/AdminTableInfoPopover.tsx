import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "#/components/ui/popover";
import { cn } from "#/lib/utils";

type AdminTableInfoPopoverProps = {
	children: ReactNode;
	className?: string;
	content: string;
	triggerClassName?: string;
};

export function AdminTableInfoPopover({
	children,
	className,
	content,
	triggerClassName
}: AdminTableInfoPopoverProps) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={content}
					className={cn(
						"font-inherit m-0 inline-block max-w-full min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left text-inherit select-text",
						triggerClassName,
						className
					)}>
					{children}
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-auto max-w-xs p-3">
				<p className="text-sm">{content}</p>
			</PopoverContent>
		</Popover>
	);
}
