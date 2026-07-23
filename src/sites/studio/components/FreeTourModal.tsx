/* oxlint-disable react/iframe-missing-sandbox -- The trusted tour app requires scripts and same-origin access to function. */
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import MagnifierIcon from "#/components/ui/magnifier-icon";
import { env } from "#/env";
import { Modal } from "#studio/components/Modal";
import { photosPageContent } from "#studio/content/photos";
import { closeModal, openFreeTourModal, useModalStore } from "#studio/lib/modal-store";

export interface FreeTourModalButtonProps {
	className?: string;
	label: string;
}

export function FreeTourModalButton({ className, label }: FreeTourModalButtonProps) {
	const isOpen = useModalStore((state) => state.modal === "freeTour");

	return (
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
				onClick={openFreeTourModal}>
				{label}
			</button>
		</AnimatedIconButton>
	);
}

export function FreeTourModal() {
	return (
		<Modal
			open
			onOpenChange={closeModal}
			title={photosPageContent.tourDialogLabel}
			description={photosPageContent.tourDialogDescription}
			closeLabel={photosPageContent.tourDialogCloseLabel}
			initialFocus="content"
			size="6xl"
			className="max-h-[calc(100vh-2rem)] overflow-y-auto">
			<div className="overflow-hidden rounded-xl border border-border bg-white">
				<iframe
					src={env.VITE_FREE_TOUR_URL}
					title={photosPageContent.tourIframeTitle}
					className="block min-h-176 w-full border-0 bg-transparent"
					sandbox="allow-scripts allow-same-origin allow-popups"
					referrerPolicy="strict-origin-when-cross-origin"
				/>
			</div>
		</Modal>
	);
}
