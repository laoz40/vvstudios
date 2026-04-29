import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import { FloatingDevMenu } from "#/components/booking/FloatingDevMenu";

const DEV_ERROR_OPTIONS = [
	{
		label: "Slot Taken",
		value: "BOOKING_TIME_UNAVAILABLE",
	},
	{
		label: "Invalid Input",
		value: "BOOKING_INVALID_INPUT",
	},
	{
		label: "Calendar Auth Failed",
		value: "GOOGLE_CALENDAR_AUTH_FAILED",
	},
	{
		label: "Availability Failed",
		value: "GOOGLE_CALENDAR_AVAILABILITY_FAILED",
	},
	{
		label: "Unknown Error",
		value: "UNKNOWN",
	},
] as const;

export type BookDevErrorCode = (typeof DEV_ERROR_OPTIONS)[number]["value"];

interface BookDevErrorPanelProps {
	onTriggerError: (code: BookDevErrorCode) => void;
}

export function BookDevErrorPanel({ onTriggerError }: BookDevErrorPanelProps): ReactNode {
	return (
		<FloatingDevMenu
			buttonLabel="Dev Errors"
			title="Booking Errors">
			{(closeMenu) =>
				DEV_ERROR_OPTIONS.map((errorOption) => (
					<Button
						key={errorOption.value}
						size="sm"
						variant="ghost"
						className="justify-start"
						onClick={() => {
							onTriggerError(errorOption.value);
							closeMenu();
						}}>
						{errorOption.label}
					</Button>
				))
			}
		</FloatingDevMenu>
	);
}
