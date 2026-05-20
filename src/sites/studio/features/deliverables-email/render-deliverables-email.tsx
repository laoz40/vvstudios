import { render } from "@react-email/render";
import {
	DeliverablesEmail,
	type DeliverablesEmailProps,
} from "#studio/features/deliverables-email/DeliverablesEmail";

export async function renderDeliverablesEmail(props: DeliverablesEmailProps) {
	return await render(<DeliverablesEmail {...props} />);
}
