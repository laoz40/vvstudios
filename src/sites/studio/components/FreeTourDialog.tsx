import { useState } from "react";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import MagnifierIcon from "#/components/ui/magnifier-icon";
import { photosPageContent } from "#studio/content/photos";
import { env } from "#/env";
import { Modal } from "#studio/components/Modal";

export interface FreeTourDialogButtonProps {
	className?: string;
	label: string;
}

export function FreeTourDialogButton({ className, label }: FreeTourDialogButtonProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<AnimatedIconButton
				variant="secondary"
				size="lg"
				className={className}
				iconPosition="before"
				renderIcon={(iconRef) => (
					<MagnifierIcon
						ref={iconRef}
						strokeWidth={3}
					/>
				)}>
				<button
					type="button"
					aria-haspopup="dialog"
					aria-expanded={isOpen}
					onClick={() => setIsOpen(true)}>
					{label}
				</button>
			</AnimatedIconButton>
			<Modal
				open={isOpen}
				onOpenChange={setIsOpen}
				title={photosPageContent.tourDialogLabel}
				description={photosPageContent.tourDialogDescription}
				closeLabel={photosPageContent.tourDialogCloseLabel}
				initialFocus="content"
				size="6xl"
				className="max-h-[calc(100vh-2rem)] overflow-y-auto">
				{isOpen ? (
					<div className="overflow-hidden rounded-xl border border-border bg-white">
						<iframe
							src={env.VITE_FREE_TOUR_URL}
							title={photosPageContent.tourIframeTitle}
							className="block min-h-176 w-full border-0 bg-transparent"
						/>
					</div>
				) : null}
			</Modal>
		</>
	);
}
