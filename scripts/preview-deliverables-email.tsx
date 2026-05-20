import { DeliverablesEmail } from "#studio/features/deliverables-email/DeliverablesEmail";
import { FIRST_TIME_DELIVERABLES_INTRO_MESSAGE } from "#studio/features/deliverables-email/lib/intro-messages";

const previewProps = {
	driveLink: "https://drive.google.com/drive/folders/1-XVZ0BSn6-pAHMhHkxMrmzyqz1wGB8b_?usp=sharing",
	introMessage: FIRST_TIME_DELIVERABLES_INTRO_MESSAGE,
	name: "Peter",
	signoffName: "Joseph",
};

export default function DeliverablesEmailPreview() {
	return <DeliverablesEmail {...previewProps} />;
}

DeliverablesEmailPreview.PreviewProps = previewProps;
