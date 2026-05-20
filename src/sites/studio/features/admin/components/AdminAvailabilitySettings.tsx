import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	bookingDayLabels,
	bookingTimeOptions,
	hoursToMinutes,
	parseNumberSetting,
	type BookingSettings,
	type NumberSettingKey,
	toBookingSettingsDraft,
} from "#studio/features/admin/lib/availability-settings";
import {
	DEFAULT_BOOKING_AVAILABILITY_SETTINGS,
	formatTimeValue,
} from "#studio/lib/bookingdatetime";

type TimeSelectProps = {
	value: string;
	onChange: (value: string) => void;
};

function TimeSelect({ value, onChange }: TimeSelectProps) {
	return (
		<label className="grid gap-1 text-sm">
			<select
				value={value}
				onChange={(event) => onChange(event.target.value)}
				className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">
				{bookingTimeOptions.map((time) => (
					<option
						key={time}
						value={time}>
						{formatTimeValue(time)}
					</option>
				))}
			</select>
		</label>
	);
}

export function AdminAvailabilitySettings() {
	const bookingSettings = useQuery(api.bookingSettings.get, {});
	const updateBookingSettings = useMutation(api.bookingSettings.update);
	const [draft, setDraft] = useState<BookingSettings>(DEFAULT_BOOKING_AVAILABILITY_SETTINGS);
	const [isOpen, setIsOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (bookingSettings) {
			setDraft(toBookingSettingsDraft(bookingSettings));
		}
	}, [bookingSettings]);

	async function handleSaveSettings() {
		setIsSaving(true);
		try {
			await updateBookingSettings(toBookingSettingsDraft(draft));
			toast.success("Availability settings saved.");
			setIsOpen(false);
		} catch {
			toast.error("Unable to save availability settings.");
		} finally {
			setIsSaving(false);
		}
	}

	function updateNumberSetting(key: NumberSettingKey, value: string) {
		setDraft((current) => ({ ...current, [key]: parseNumberSetting(value) }));
	}

	function updateLeadTimeHours(value: string) {
		setDraft((current) => ({ ...current, leadTimeMinutes: hoursToMinutes(value) }));
	}

	function updateDaySchedule(day: number, field: "endTime" | "startTime", value: string) {
		setDraft((current) => ({
			...current,
			weekSchedule: current.weekSchedule.map((schedule, index) =>
				index === day ? { ...schedule, [field]: value } : schedule,
			),
		}));
	}

	return (
		<Dialog
			open={isOpen}
			onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm">
					<Clock aria-hidden />
					Availability settings
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>Availability settings</DialogTitle>
				</DialogHeader>

				<div className="grid gap-5">
					<div className="grid gap-4 md:grid-cols-3">
						<div className="grid gap-2">
							<Label htmlFor="lead-time-hours">Minimum notice</Label>
							<div className="flex items-center gap-2">
								<Input
									id="lead-time-hours"
									type="number"
									min={0}
									step={0.5}
									value={draft.leadTimeMinutes / 60}
									onChange={(event) => updateLeadTimeHours(event.target.value)}
								/>
								<span className="text-sm text-muted-foreground">hours</span>
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="event-buffer-minutes">Time between events</Label>
							<div className="flex items-center gap-2">
								<Input
									id="event-buffer-minutes"
									type="number"
									min={0}
									value={draft.eventBufferMinutes}
									onChange={(event) =>
										updateNumberSetting("eventBufferMinutes", event.target.value)
									}
								/>
								<span className="text-sm text-muted-foreground">minutes</span>
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="max-days-ahead">Booking range</Label>
							<div className="flex items-center gap-2">
								<Input
									id="max-days-ahead"
									type="number"
									min={1}
									value={draft.maxDaysAhead}
									onChange={(event) => updateNumberSetting("maxDaysAhead", event.target.value)}
								/>
								<span className="text-sm text-muted-foreground">days</span>
							</div>
						</div>
					</div>

					<div className="overflow-hidden rounded-md border">
						{bookingDayLabels.map((label, day) => (
							<div
								key={label}
								className="grid gap-3 border-b p-3 last:border-b-0 md:grid-cols-[80px_1fr_1fr] md:items-center">
								<p className="text-sm font-medium">{label}</p>
								<TimeSelect
									value={draft.weekSchedule[day].startTime}
									onChange={(value) => updateDaySchedule(day, "startTime", value)}
								/>
								<TimeSelect
									value={draft.weekSchedule[day].endTime}
									onChange={(value) => updateDaySchedule(day, "endTime", value)}
								/>
							</div>
						))}
					</div>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => setIsOpen(false)}
						disabled={isSaving}>
						Cancel
					</Button>
					<Button
						onClick={handleSaveSettings}
						disabled={isSaving || !bookingSettings}>
						{isSaving ? "Saving..." : "Save settings"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
