import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Button } from "#/components/ui/button";
import { api } from "../../../convex/_generated/api";

const DEV_SCENARIO_OPTIONS = [
	{ label: "Processing", value: "processing" },
	{ label: "Confirmed", value: "confirmed" },
	{ label: "Expired", value: "expired" },
	{ label: "Slot Taken", value: "slot_taken" },
	{ label: "Calendar Failed", value: "calendar_failed" },
	{ label: "Not Found", value: "not_found" },
] as const;

export type DevBookingScenario = (typeof DEV_SCENARIO_OPTIONS)[number]["value"];

export interface BookingCompleteSearch {
	dev_scenario?: DevBookingScenario;
	session_id?: string;
}

export type BookingStatus = NonNullable<
	ReturnType<typeof useQuery<typeof api.bookings.getBookingStatusByStripeSessionId>>
>;

export function BookingCompleteDevScenarioPanel() {
	return (
		<section className="rounded-xl border border-border bg-card p-6">
			<div className="space-y-2">
				<h2 className="text-lg font-semibold">Dev booking scenarios</h2>
				<p className="text-sm text-muted-foreground">
					Use these preview links to test the booking result states without Stripe or Google
					Calendar.
				</p>
			</div>
			<div className="mt-4 flex flex-wrap gap-3">
				{DEV_SCENARIO_OPTIONS.map((scenario) => (
					<Button
						asChild
						key={scenario.value}
						size="sm"
						variant="outline">
						<Link
							to="/booking-complete"
							search={{ dev_scenario: scenario.value }}>
							{scenario.label}
						</Link>
					</Button>
				))}
			</div>
		</section>
	);
}

export function parseBookingCompleteSearch(search: Record<string, unknown>): BookingCompleteSearch {
	return {
		dev_scenario: parseDevBookingScenario(search.dev_scenario),
		session_id:
			typeof search.session_id === "string" && search.session_id.length > 0
				? search.session_id
				: undefined,
	};
}

export function buildDevBooking(devScenario: DevBookingScenario): BookingStatus | null {
	if (devScenario === "not_found") {
		return null;
	}

	const now = Date.now();
	const baseBooking: BookingStatus = {
		_id: "dev-booking" as BookingStatus["_id"],
		abn: "",
		accountName: "VV Studios",
		addons: ["4K UHD Recording"],
		bookingConfirmedAt: undefined,
		bookingFailureCode: undefined,
		checkoutExpiredAt: undefined,
		date: "2026-05-12",
		duration: "2h",
		email: "test@example.com",
		name: "Test Booker",
		notes: "Dev-only booking scenario preview.",
		paymentCompletedAt: undefined,
		phone: "0400 000 000",
		service: "Table Setup",
		status: "pending_payment",
		time: "10:00",
	};

	if (devScenario === "processing") {
		return baseBooking;
	}

	if (devScenario === "confirmed") {
		return {
			...baseBooking,
			bookingConfirmedAt: now,
			paymentCompletedAt: now,
			status: "confirmed",
		};
	}

	if (devScenario === "expired") {
		return {
			...baseBooking,
			checkoutExpiredAt: now,
			status: "expired",
		};
	}

	if (devScenario === "slot_taken") {
		return {
			...baseBooking,
			bookingFailureCode: "BOOKING_TIME_UNAVAILABLE",
			paymentCompletedAt: now,
			status: "failed",
		};
	}

	return {
		...baseBooking,
		bookingFailureCode: "GOOGLE_CALENDAR_CREATE_FAILED",
		paymentCompletedAt: now,
		status: "failed",
	};
}

function parseDevBookingScenario(value: unknown): DevBookingScenario | undefined {
	return DEV_SCENARIO_OPTIONS.some((scenario) => scenario.value === value)
		? (value as DevBookingScenario)
		: undefined;
}
