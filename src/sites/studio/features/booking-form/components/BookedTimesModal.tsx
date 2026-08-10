import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Modal } from "#studio/components/Modal";
import { formatTimeValue, type BusyPeriod } from "#studio/lib/bookingdatetime";

export function BookedTimesModal({
	busyPeriods,
	selectedDate
}: {
	busyPeriods: BusyPeriod[];
	selectedDate: Date | undefined;
}) {
	const [open, setOpen] = useState(false);
	const hasWholeDayBusyPeriod = busyPeriods.some(
		(period) => period.start === "00:00" && period.end === "23:59"
	);

	if (busyPeriods.length === 0 || hasWholeDayBusyPeriod || !selectedDate) {
		return null;
	}

	const selectedDateLabel = selectedDate.toLocaleDateString("en-AU", {
		weekday: "long",
		day: "numeric",
		month: "long"
	});

	return (
		<span className="text-foreground">
			<Button
				type="button"
				variant="ghost"
				size="xs"
				className="text-sm! font-light! text-muted-foreground"
				onClick={() => setOpen(true)}>
				View booked times
			</Button>
			<Modal
				open={open}
				onOpenChange={setOpen}
				closeLabel="Close unavailable periods"
				title="Unavailable periods"
				description={`These periods are unavailable on ${selectedDateLabel}.`}>
				<ul className="flex flex-col gap-2">
					{busyPeriods.map((period) => (
						<li
							key={`${period.start}-${period.end}`}
							className="rounded-md bg-muted px-3 py-2 font-medium text-muted-foreground">
							{formatTimeValue(period.start)} – {formatTimeValue(period.end)}
						</li>
					))}
				</ul>
			</Modal>
		</span>
	);
}
