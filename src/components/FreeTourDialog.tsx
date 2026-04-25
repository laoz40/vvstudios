import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { photosPageContent } from "#/content/photos";
import { env } from "#/env";
import { Dialog } from "radix-ui";

export interface FreeTourDialogButtonProps {
	className?: string;
	label: string;
}

export function FreeTourDialogButton({ className, label }: FreeTourDialogButtonProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Dialog.Root
			open={isOpen}
			onOpenChange={setIsOpen}>
			<Dialog.Trigger asChild>
				<Button
					type="button"
					variant="outline"
					size="lg"
					className={className}>
					{label}
				</Button>
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
				<Dialog.Content className="bg-popover text-popover-foreground ring-foreground/10 fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-1.5rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl p-4 text-sm outline-none ring-1 max-h-[calc(100vh-2rem)] sm:w-[calc(100%-2rem)] sm:p-6">
					<div className="space-y-2 pr-10">
						<Dialog.Title className="text-xl font-semibold">
							{photosPageContent.tourDialogLabel}
						</Dialog.Title>
						<Dialog.Description className="text-muted-foreground text-sm leading-6">
							{photosPageContent.tourDialogDescription}
						</Dialog.Description>
					</div>

					<Dialog.Close asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="absolute top-2 right-2"
							aria-label={photosPageContent.tourDialogCloseLabel}>
							<X />
						</Button>
					</Dialog.Close>

					<div className="overflow-hidden rounded-xl border border-border bg-white">
						<iframe
							src={env.VITE_FREE_TOUR_URL}
							title={photosPageContent.tourIframeTitle}
							className="block min-h-176 w-full border-0 bg-transparent"
						/>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
