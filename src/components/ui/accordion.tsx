"use client";

import * as React from "react";
import { Accordion as AccordionPrimitive } from "radix-ui";

import { cn } from "#/lib/utils";

function Accordion({ ...props }: React.ComponentProps<typeof AccordionPrimitive.Root>) {
	return (
		<AccordionPrimitive.Root
			data-slot="accordion"
			{...props}
		/>
	);
}

function AccordionItem({
	className,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
	return (
		<AccordionPrimitive.Item
			data-slot="accordion-item"
			className={cn("border-b border-border last:border-b-0", className)}
			{...props}
		/>
	);
}

type AccordionTriggerProps = React.ComponentProps<typeof AccordionPrimitive.Trigger> & {
	showArrow?: boolean;
};

function AccordionTrigger({
	className,
	children,
	showArrow = true,
	...props
}: AccordionTriggerProps) {
	return (
		<AccordionPrimitive.Header className="flex">
			<AccordionPrimitive.Trigger
				data-slot="accordion-trigger"
				className={cn(
					"group flex flex-1 items-start justify-between gap-4 py-5 text-left text-base font-semibold text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:items-center md:py-6",
					className
				)}
				{...props}>
				<span className="w-full leading-snug">{children}</span>
				{showArrow ? (
					<span
						aria-hidden
						data-slot="accordion-chevron"
						className="mt-0.5 inline-flex shrink-0 items-center justify-center text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 group-data-[state=open]:text-foreground md:mt-0">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width={24}
							height={24}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							strokeLinecap="round"
							strokeLinejoin="round"
							className="accordion-chevron-icon">
							<path
								stroke="none"
								d="M0 0h24v24H0z"
								fill="none"
							/>
							<path d="M6 9l6 6l6 -6" />
						</svg>
					</span>
				) : null}
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

function AccordionContent({
	className,
	children,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
	return (
		<AccordionPrimitive.Content
			data-slot="accordion-content"
			className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none"
			{...props}>
			<div
				data-slot="accordion-content-inner"
				className={cn(
					"max-w-5xl pb-5 text-sm leading-7 text-pretty text-muted-foreground md:pb-6 md:text-base",
					className
				)}>
				{children}
			</div>
		</AccordionPrimitive.Content>
	);
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
