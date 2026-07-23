import { Link } from "@tanstack/react-router";
import { studioSite } from "#/config/sites";
import { useQuery } from "convex/react";
import { Button } from "#/components/ui/button";
import { FloatingDevMenu } from "#studio/components/booking/FloatingDevMenu";
import { ADDON_OPTIONS } from "#studio/features/booking-form/lib/booking-form-model";
import { api } from "#convex/_generated/api";
import { z } from "zod";

const DEV_SCENARIO_OPTIONS = [
	{ label: "Processing", value: "processing" },
	{ label: "Confirmed", value: "confirmed" },
	{ label: "Email Failed", value: "email_failed" },
	{ label: "Package Request", value: "package_request" },
	{ label: "Expired", value: "expired" },
	{ label: "Slot Taken", value: "slot_taken" },
	{ label: "Calendar Failed", value: "calendar_failed" },
	{ label: "Not Found", value: "not_found" }
] as const;

export type DevBookingScenario = (typeof DEV_SCENARIO_OPTIONS)[number]["value"];

export interface BookingCompleteSearch {
	dev_scenario?: DevBookingScenario;
	multi_booking_id?: string;
	package_size?: 4 | 8 | 12;
	session_id?: string;
}

export type BookingStatus = NonNullable<
	ReturnType<typeof useQuery<typeof api.sessions.getSessionStatusByStripeSessionId>>
>;

const devBookingIdSchema = z.custom<BookingStatus["_id"]>(
	(value) => typeof value === "string" && value.length > 0
);

export function BookingCompleteDevScenarioPanel() {
	return (
		<FloatingDevMenu
			buttonLabel="Dev States"
			title="Booking States">
			{(closeMenu) =>
				DEV_SCENARIO_OPTIONS.map((scenario) => (
					<Button
						asChild
						key={scenario.value}
						size="sm"
						variant="ghost"
						className="justify-start">
						<Link
							to={studioSite.routes.bookingComplete}
							search={{ dev_scenario: scenario.value }}
							onClick={closeMenu}>
							{scenario.label}
						</Link>
					</Button>
				))
			}
		</FloatingDevMenu>
	);
}

export function parseBookingCompleteSearch(search: Record<string, unknown>): BookingCompleteSearch {
	return {
		dev_scenario: parseDevBookingScenario(search.dev_scenario),
		multi_booking_id: parseNonEmptyString(search.multi_booking_id),
		package_size: parsePackageSize(search.package_size),
		session_id: parseNonEmptyString(search.session_id)
	};
}

export function buildDevBooking(devScenario: DevBookingScenario): BookingStatus | null {
	if (devScenario === "not_found" || devScenario === "package_request") {
		return null;
	}

	const now = Date.now();
	const baseBooking: BookingStatus = {
		_id: devBookingIdSchema.parse("dev-booking"),
		addons: [...ADDON_OPTIONS],
		bookingConfirmedAt: undefined,
		bookingFailureCode: undefined,
		date: "2026-05-12",
		essentialEditQuantity: "1",
		clipsPackageQuantity: "2",
		duration: "2h",
		pendingPaymentCreatedAt: now,
		paymentCompletedAt: undefined,
		service: "Table Setup",
		status: "pending_payment",
		time: "10:00"
	};

	if (devScenario === "processing") {
		return baseBooking;
	}

	if (devScenario === "confirmed") {
		return {
			...baseBooking,
			bookingConfirmedAt: now,
			paymentCompletedAt: now,
			status: "confirmed"
		};
	}

	if (devScenario === "email_failed") {
		return {
			...baseBooking,
			bookingConfirmedAt: now,
			bookingFailureCode: "BOOKING_INVOICE_EMAIL_FAILED",
			paymentCompletedAt: now,
			status: "email_failed"
		};
	}

	if (devScenario === "expired") {
		return { ...baseBooking, status: "expired" };
	}

	if (devScenario === "slot_taken") {
		return {
			...baseBooking,
			bookingFailureCode: "BOOKING_TIME_UNAVAILABLE",
			paymentCompletedAt: now,
			status: "failed"
		};
	}

	return {
		...baseBooking,
		bookingFailureCode: "GOOGLE_CALENDAR_CREATE_FAILED",
		paymentCompletedAt: now,
		status: "failed"
	};
}

function parseDevBookingScenario(value: unknown): DevBookingScenario | undefined {
	return DEV_SCENARIO_OPTIONS.find((scenario) => scenario.value === value)?.value;
}

function parseNonEmptyString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parsePackageSize(value: unknown): 4 | 8 | 12 | undefined {
	const numericValue = typeof value === "string" ? Number(value) : value;

	if (numericValue === 4 || numericValue === 8 || numericValue === 12) {
		return numericValue;
	}

	return undefined;
}
