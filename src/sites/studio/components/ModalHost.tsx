import { FreeTourModal } from "#studio/components/FreeTourModal";
import { exhaustiveCheck } from "#/lib/result";
import { GiveFeedbackModalHost } from "#studio/components/GiveFeedbackModalHost";
import { useModalStore } from "#studio/lib/modal-store";

export function ModalHost() {
	const modalState = useModalStore((state) => state);

	const modal = modalState.modal;

	switch (modal) {
		case "feedback":
			return <GiveFeedbackModalHost />;

		case "freeTour":
			return <FreeTourModal />;

		case "none":
			return null;
		default:
			return exhaustiveCheck(modal);
	}
}
