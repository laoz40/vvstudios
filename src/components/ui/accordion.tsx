"use client";

import { ChevronDown } from "lucide-react";
import type { HTMLMotionProps, Transition } from "motion/react";
import { motion } from "motion/react";
import type * as React from "react";
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
					"group flex flex-1 items-start justify-between gap-4 py-5 text-left text-base font-semibold text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:items-center md:py-6 [&[data-state=open]>svg]:rotate-180 [&[data-state=open]>svg]:text-foreground",
					className,
				)}
				{...props}>
				<span className="leading-snug">{children}</span>
				{showArrow ? (
					<ChevronDown
						aria-hidden
						className="mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200 md:mt-0"
					/>
				) : null}
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

type AccordionContentProps = Omit<
	React.ComponentProps<typeof AccordionPrimitive.Content>,
	"asChild" | "forceMount"
> &
	HTMLMotionProps<"div"> & {
		transition?: Transition;
		keepRendered?: boolean;
	};

function AccordionContent({
	className,
	children,
	transition = { type: "spring", stiffness: 150, damping: 22 },
	keepRendered = false,
	...props
}: AccordionContentProps) {
	return (
		<AccordionPrimitive.Content
			data-slot="accordion-content"
			forceMount={keepRendered || undefined}
			className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
			<motion.div
				data-slot="accordion-content-inner"
				layout
				transition={transition}
				className={cn(
					"max-w-5xl pb-5 text-sm leading-7 text-pretty text-muted-foreground md:pb-6 md:text-base",
					className,
				)}
				{...props}>
				{children}
			</motion.div>
		</AccordionPrimitive.Content>
	);
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
