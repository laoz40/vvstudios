import { render } from "@react-email/render";
import { ReminderEmail, type ReminderEmailProps } from "#/features/reminder-email/ReminderEmail";

export async function renderReminderEmail(props: ReminderEmailProps) {
	return await render(<ReminderEmail {...props} />);
}
