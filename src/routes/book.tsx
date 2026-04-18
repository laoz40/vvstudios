import { createFileRoute } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { type ComponentProps, useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";

const SERVICES = ["Table Setup", "Open Setup"];
const DURATION_OPTIONS = ["1h", "2h", "3h"];
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
	const hours = String(Math.floor(index / 2)).padStart(2, "0");
	const minutes = index % 2 === 0 ? "00" : "30";

	return `${hours}:${minutes}`;
});

interface BookingFormState {
	name: string;
	email: string;
	date: string;
	time: string;
	duration: string;
	service: string;
	notes: string;
}

interface SubmittedBooking {
	name: string;
	date: string;
	time: string;
	duration: string;
	service: string;
}

interface BookingErrorWithData {
	data?: {
		code?: string;
	};
}

const INITIAL_FORM: BookingFormState = {
	name: "",
	email: "",
	date: "",
	time: TIME_OPTIONS[18],
	duration: DURATION_OPTIONS[0],
	service: SERVICES[0],
	notes: "",
};

export const Route = createFileRoute("/book")({
	component: BookingPage,
});

function BookingPage() {
	const createBooking = useAction(api.googleCalendar.createBookingWithCalendarEvent);
	const getAvailableBookingTimes = useAction(api.googleCalendar.getAvailableBookingTimes);

	const [form, setForm] = useState(INITIAL_FORM);
	const [availableTimes, setAvailableTimes] = useState<string[]>([]);
	const [availabilityError, setAvailabilityError] = useState("");
	const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
	const [submittedBooking, setSubmittedBooking] = useState<SubmittedBooking | null>(null);
	const [error, setError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (!form.date) {
			setAvailableTimes([]);
			setAvailabilityError("");
			setForm((current) => ({ ...current, time: "" }));
			return;
		}

		let isCancelled = false;

		const loadAvailability = async () => {
			setAvailabilityError("");
			setIsLoadingAvailability(true);

			try {
				const result = await getAvailableBookingTimes({
					date: form.date,
					duration: form.duration,
				});

				if (isCancelled) {
					return;
				}

				setAvailableTimes(result.times);
				setForm((current) => ({
					...current,
					time: result.times.includes(current.time) ? current.time : (result.times[0] ?? ""),
				}));
			} catch (availabilityLookupError) {
				if (isCancelled) {
					return;
				}

				setAvailableTimes([]);
				setForm((current) => ({ ...current, time: "" }));
				setAvailabilityError(getBookingErrorMessage(availabilityLookupError));
			} finally {
				if (!isCancelled) {
					setIsLoadingAvailability(false);
				}
			}
		};

		void loadAvailability();

		return () => {
			isCancelled = true;
		};
	}, [form.date, form.duration, getAvailableBookingTimes]);

	const handleSubmit: NonNullable<ComponentProps<"form">["onSubmit"]> = async (event) => {
		event.preventDefault();
		setError("");
		setIsSubmitting(true);

		try {
			await createBooking({
				name: form.name,
				email: form.email,
				date: form.date,
				time: form.time,
				duration: form.duration,
				service: form.service,
				notes: form.notes || undefined,
			});

			setSubmittedBooking({
				name: form.name,
				date: form.date,
				time: form.time,
				duration: form.duration,
				service: form.service,
			});
			setForm(INITIAL_FORM);
		} catch (submissionError) {
			setError(getBookingErrorMessage(submissionError));
		} finally {
			setIsSubmitting(false);
		}
	};

	if (submittedBooking) {
		return (
			<main>
				<h1>Booking confirmed</h1>
				<p>
					Thank you, {submittedBooking.name}. Your booking for{" "}
					<strong>{submittedBooking.service}</strong> on <strong>{submittedBooking.date}</strong> at{" "}
					<strong>{submittedBooking.time}</strong> for <strong>{submittedBooking.duration}</strong>{" "}
					has been received.
				</p>
				<button
					type="button"
					onClick={() => setSubmittedBooking(null)}>
					Create another booking
				</button>
			</main>
		);
	}

	return (
		<main>
			<h1>Book</h1>
			<form onSubmit={handleSubmit}>
				<div>
					<label htmlFor="name">Name *</label>
					<br />
					<input
						id="name"
						type="text"
						value={form.name}
						onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
						required
					/>
				</div>

				<div>
					<label htmlFor="email">Email *</label>
					<br />
					<input
						id="email"
						type="email"
						value={form.email}
						onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
						required
					/>
				</div>

				<div>
					<label htmlFor="date">Date *</label>
					<br />
					<input
						id="date"
						type="date"
						value={form.date}
						onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
						required
					/>
				</div>

				<div>
					<label htmlFor="time">Time *</label>
					<br />
					<select
						id="time"
						value={form.time}
						onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
						disabled={!form.date || isLoadingAvailability || availableTimes.length === 0}
						required>
						{availableTimes.map((time) => (
							<option
								key={time}
								value={time}>
								{time}
							</option>
						))}
					</select>
					{isLoadingAvailability ? <p>Loading available times…</p> : null}
					{!isLoadingAvailability &&
					form.date &&
					availableTimes.length === 0 &&
					!availabilityError ? (
						<p>No times available for this date.</p>
					) : null}
					{availabilityError ? <p>{availabilityError}</p> : null}
				</div>

				<div>
					<label htmlFor="duration">Duration *</label>
					<br />
					<select
						id="duration"
						value={form.duration}
						onChange={(event) =>
							setForm((current) => ({ ...current, duration: event.target.value }))
						}
						required>
						{DURATION_OPTIONS.map((duration) => (
							<option
								key={duration}
								value={duration}>
								{duration}
							</option>
						))}
					</select>
				</div>

				<div>
					<label htmlFor="service">Service *</label>
					<br />
					<select
						id="service"
						value={form.service}
						onChange={(event) =>
							setForm((current) => ({ ...current, service: event.target.value }))
						}
						required>
						{SERVICES.map((service) => (
							<option
								key={service}
								value={service}>
								{service}
							</option>
						))}
					</select>
				</div>

				<div>
					<label htmlFor="notes">Notes</label>
					<br />
					<textarea
						id="notes"
						value={form.notes}
						onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
						rows={4}
					/>
				</div>

				{error ? <p>{error}</p> : null}

				<button
					type="submit"
					disabled={isSubmitting || !form.time || isLoadingAvailability}>
					{isSubmitting ? "Submitting..." : "Create booking"}
				</button>
			</form>
		</main>
	);
}

function getBookingErrorMessage(error: unknown) {
	const errorWithData =
		typeof error === "object" && error !== null ? (error as BookingErrorWithData) : null;
	const code = errorWithData?.data?.code;

	if (code === "BOOKING_TIME_UNAVAILABLE") {
		return "That time was just taken. Please choose another available time.";
	}

	if (code === "GOOGLE_CALENDAR_AUTH_FAILED") {
		return "Google Calendar authentication failed. Regenerate the refresh token and try again.";
	}

	if (code === "GOOGLE_CALENDAR_AVAILABILITY_FAILED") {
		return "Could not load availability right now. Check the Convex logs for the Google error details.";
	}

	return error instanceof Error ? error.message : "Something went wrong.";
}
