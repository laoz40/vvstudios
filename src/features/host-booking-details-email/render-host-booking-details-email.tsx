import { render } from "@react-email/render";
import {
	HostBookingDetailsEmail,
	type HostBookingDetailsEmailProps,
} from "#/features/host-booking-details-email/HostBookingDetailsEmail";

export async function renderHostBookingDetailsEmail(props: HostBookingDetailsEmailProps) {
	return await render(<HostBookingDetailsEmail {...props} />);
}
