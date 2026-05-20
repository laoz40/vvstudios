import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

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
	const dialogRef = useRef<HTMLDialogElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const dialog = dialogRef.current;

		if (!dialog) {
			return;
		}

		if (open && !dialog.open) {
			dialog.showModal();
			requestAnimationFrame(() => {
				if (initialFocus === "close") {
					closeButtonRef.current?.focus();
					return;
				}

				const firstContentElement = getFocusableElements(dialog).find(
					(element) => element !== closeButtonRef.current,
				);
				firstContentElement?.focus();
			});

			return;
		}

		if (!open && dialog.open) {
			dialog.close();
		}
	}, [initialFocus, open]);

	useEffect(() => {
		if (!open) {
			return;
		}

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [open]);

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby={titleId}
			aria-describedby={description ? descriptionId : undefined}
			className="fixed inset-0 m-0 h-dvh w-dvw max-h-none max-w-none overflow-y-auto bg-transparent p-4 text-inherit backdrop:bg-black/80"
			data-lenis-prevent
			onCancel={(event) => {
				if (preventClose) {
					event.preventDefault();
				}
			}}
			onClose={() => {
				onOpenChange(false);
			}}
			onMouseDown={(event) => {
				if (!preventClose && event.target === event.currentTarget) {
					event.currentTarget.close();
				}
			}}
			onKeyDown={(event) => {
				if (event.key !== "Tab") {
					return;
				}

				const focusableElements = getFocusableElements(event.currentTarget);
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
			<div className="flex min-h-full items-center justify-center overscroll-contain">
				<div
					ref={contentRef}
					className={cn("relative w-full outline-none", sizeClassNames[size])}>
					<Button
						ref={closeButtonRef}
						type="button"
						variant="ghost"
						size="icon"
						className="absolute -top-4 -right-4 z-10 rounded-full bg-background/80 shadow-sm ring-1 ring-border backdrop-blur"
						aria-label={closeLabel}
						disabled={preventClose}
						onClick={() => {
							dialogRef.current?.close();
						}}>
						<X className="size-5" />
					</Button>
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
				</div>
			</div>
		</dialog>
	);
}
