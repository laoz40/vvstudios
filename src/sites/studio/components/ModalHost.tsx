import { FreeTourModal } from "#studio/components/FreeTourModal";
import { GiveFeedbackModalHost } from "#studio/components/GiveFeedbackModalHost";
import { useModalStore } from "#studio/lib/modal-store";

export function ModalHost() {
	const modalState = useModalStore((state) => state);

	switch (modalState.modal) {
		case "feedback":
			return <GiveFeedbackModalHost />;

		case "freeTour":
			return <FreeTourModal />;

		case "none":
			return null;

		default: {
			const _exhaustive: never = modalState;
			return _exhaustive;
		}
	}
}
