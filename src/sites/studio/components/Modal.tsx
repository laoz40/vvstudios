import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

type InertElement = HTMLElement & { inert: boolean };

export type ModalSize = "md" | "2xl" | "3xl" | "5xl" | "6xl";

export interface ModalProps {
	bodyClassName?: string;
	children?: ReactNode;
	className?: string;
	closeLabel: string;
	description?: ReactNode;
	footer?: ReactNode;
	hideHeader?: boolean;
	initialFocus?: "close" | "content";
	onOpenChange: (open: boolean) => void;
	open: boolean;
	preventClose?: boolean;
	size?: ModalSize;
	title: ReactNode;
}

const sizeClassNames: Record<ModalSize, string> = {
	md: "max-w-md",
	"2xl": "max-w-2xl",
	"3xl": "max-w-3xl",
	"5xl": "max-w-5xl",
	"6xl": "max-w-6xl",
};

function getFocusableElements(container: HTMLElement) {
	return Array.from(
		container.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), iframe, embed, object, [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
		),
	).filter((element) => !element.hasAttribute("disabled") && !element.getAttribute("aria-hidden"));
}

export function Modal({
	bodyClassName,
	children,
	className,
	closeLabel,
	description,
	footer,
	hideHeader = false,
	initialFocus = "close",
	onOpenChange,
	open,
	preventClose = false,
	size = "md",
	title,
}: ModalProps) {
	const titleId = useId();
	const descriptionId = useId();
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const [portalElement, setPortalElement] = useState<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!open) {
			return;
		}

		const element = document.createElement("div");
		element.dataset.modalRoot = "true";
		document.body.append(element);
		setPortalElement(element);

		return () => {
			element.remove();
			setPortalElement(null);
		};
	}, [open]);

	useEffect(() => {
		if (!portalElement) {
			return;
		}

		const previousActiveElement =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const previousOverflow = document.body.style.overflow;
		const siblings = Array.from(document.body.children).filter(
			(element) => element !== portalElement,
		);
		const previousSiblingState = siblings.map((element) => ({
			element: element as InertElement,
			inert: (element as InertElement).inert,
			ariaHidden: element.getAttribute("aria-hidden"),
		}));

		document.body.style.overflow = "hidden";
		for (const { element } of previousSiblingState) {
			element.inert = true;
			element.setAttribute("aria-hidden", "true");
		}
		if (initialFocus === "content") {
			contentRef.current?.focus();
		} else {
			closeButtonRef.current?.focus();
		}

		return () => {
			document.body.style.overflow = previousOverflow;
			for (const { element, inert, ariaHidden } of previousSiblingState) {
				element.inert = inert;
				if (ariaHidden === null) {
					element.removeAttribute("aria-hidden");
				} else {
					element.setAttribute("aria-hidden", ariaHidden);
				}
			}
			previousActiveElement?.focus();
		};
	}, [initialFocus, portalElement]);

	if (!portalElement) {
		return null;
	}

	return createPortal(
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby={titleId}
			aria-describedby={description ? descriptionId : undefined}
			className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/80 p-4"
			data-lenis-prevent
			onClick={(event) => {
				if (!preventClose && event.target === event.currentTarget) {
					onOpenChange(false);
				}
			}}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					if (!preventClose) {
						onOpenChange(false);
					}
					return;
				}

				if (event.key !== "Tab" || !contentRef.current) {
					return;
				}

				const focusableElements = getFocusableElements(contentRef.current);
				const firstElement = focusableElements[0];
				const lastElement = focusableElements.at(-1);

				if (!firstElement || !lastElement) {
					event.preventDefault();
					return;
				}

				if (event.shiftKey && document.activeElement === firstElement) {
					event.preventDefault();
					lastElement.focus();
					return;
				}

				if (!event.shiftKey && document.activeElement === lastElement) {
					event.preventDefault();
					firstElement.focus();
				}
			}}
			onWheel={(event) => {
				event.stopPropagation();
			}}>
			<div
				ref={contentRef}
				tabIndex={-1}
				className={cn("relative w-full outline-none", sizeClassNames[size])}>
				<div
					className={cn(
						"bg-popover text-popover-foreground ring-foreground/10 grid w-full gap-4 rounded-xl p-4 text-sm shadow-2xl outline-none ring-1 sm:p-6",
						className,
					)}>
					<div
						className={cn(
							"flex flex-col gap-2 pr-8 text-center sm:text-left",
							hideHeader && "sr-only",
						)}>
						<h2
							id={titleId}
							className="text-xl font-semibold tracking-tight">
							{title}
						</h2>
						{description ? (
							<p
								id={descriptionId}
								className="text-muted-foreground text-sm leading-6">
								{description}
							</p>
						) : null}
					</div>

					<div className={bodyClassName}>{children}</div>
					{footer ? (
						<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
					) : null}
				</div>
				<Button
					ref={closeButtonRef}
					type="button"
					variant="ghost"
					size="icon"
					className="absolute -top-4 -right-4 z-10 rounded-full bg-background/80 shadow-sm ring-1 ring-border backdrop-blur"
					aria-label={closeLabel}
					disabled={preventClose}
					onClick={() => onOpenChange(false)}>
					<X className="size-5" />
				</Button>
			</div>
		</div>,
		portalElement,
	);
}
