import { useEffect, useState } from "react";
import { Checkbox } from "#/components/ui/checkbox";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Textarea } from "#/components/ui/textarea";
import type { Doc } from "#convex/_generated/dataModel";
import {
	ADDON_OPTIONS,
	SERVICES,
	type BookingFormValues,
} from "#studio/features/booking-form/lib/form-shared";
import { toOptionId } from "#studio/lib/bookingdatetime";
import { X } from "lucide-react";

type BookingRecord = Doc<"bookings">;

export type BookingEditDraft = {
	accountName: string;
	addons: BookingFormValues["addons"];
	abn: string;
	date: string;
	email: string;
	name: string;
	notes: string;
	phone: string;
	service: BookingRecord["service"] | "";
	time: string;
};

export type BookingEditDialogProps = {
	open: boolean;
	booking: BookingRecord;
	bookingId: string;
	onOpenChange: (open: boolean) => void;
	onSave: (values: BookingEditDraft) => Promise<void>;
	isSaving: boolean;
};

function isAddonOption(value: string): value is BookingFormValues["addons"][number] {
	return ADDON_OPTIONS.includes(value as BookingFormValues["addons"][number]);
}

function buildBookingEditDraft(booking: BookingRecord): BookingEditDraft {
	return {
		name: booking.name,
		accountName: booking.accountName,
		abn: booking.abn ?? "",
		date: booking.date,
		time: booking.time,
		service: booking.service,
		addons: booking.addons.filter(isAddonOption),
		email: booking.email,
		phone: booking.phone,
		notes: booking.notes ?? "",
	};
}

export function BookingEditDialog({
	open,
	booking,
	bookingId,
	onOpenChange,
	onSave,
	isSaving,
}: BookingEditDialogProps) {
	const [draft, setDraft] = useState<BookingEditDraft>(() => buildBookingEditDraft(booking));

	useEffect(() => {
		if (open) {
			setDraft(buildBookingEditDraft(booking));
		}
	}, [booking, open]);

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (isSaving && !nextOpen) {
					return;
				}

				onOpenChange(nextOpen);
			}}>
			<DialogContent
				className="overflow-y-auto sm:max-w-4xl"
				onInteractOutside={(event) => {
					if (isSaving) {
						event.preventDefault();
					}
				}}
				onEscapeKeyDown={(event) => {
					if (isSaving) {
						event.preventDefault();
					}
				}}>
				<DialogClose asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute top-2 right-2"
						aria-label="Close edit booking dialog"
						disabled={isSaving}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="text-left">
					<DialogTitle>Edit booking</DialogTitle>
					<DialogDescription>
						This will make changes to booking {bookingId}. There is no turning back from this. USE
						CAUTION.
					</DialogDescription>
				</DialogHeader>

				<form
					className="grid gap-6"
					onSubmit={(event) => {
						event.preventDefault();
						void onSave(draft);
					}}>
					<section className="grid gap-4 md:grid-cols-2">
						<div className="grid gap-2">
							<Label htmlFor="edit-booking-name">Customer name</Label>
							<Input
								id="edit-booking-name"
								name="name"
								autoComplete="name"
								value={draft.name}
								onChange={(event) => {
									setDraft((current) => ({ ...current, name: event.target.value }));
								}}
								required
								disabled={isSaving}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="edit-booking-account-name">Account name</Label>
							<Input
								id="edit-booking-account-name"
								name="accountName"
								autoComplete="organization"
								value={draft.accountName}
								onChange={(event) => {
									setDraft((current) => ({ ...current, accountName: event.target.value }));
								}}
								required
								disabled={isSaving}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="edit-booking-abn">ABN</Label>
							<Input
								id="edit-booking-abn"
								name="abn"
								autoComplete="off"
								spellCheck={false}
								value={draft.abn}
								onChange={(event) => {
									setDraft((current) => ({ ...current, abn: event.target.value }));
								}}
								inputMode="numeric"
								placeholder="Optional"
								disabled={isSaving}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="edit-booking-email">Email</Label>
							<Input
								id="edit-booking-email"
								name="email"
								type="email"
								autoComplete="email"
								spellCheck={false}
								value={draft.email}
								onChange={(event) => {
									setDraft((current) => ({ ...current, email: event.target.value }));
								}}
								required
								disabled={isSaving}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="edit-booking-phone">Phone number</Label>
							<Input
								id="edit-booking-phone"
								name="phone"
								type="tel"
								autoComplete="tel"
								inputMode="tel"
								value={draft.phone}
								onChange={(event) => {
									setDraft((current) => ({ ...current, phone: event.target.value }));
								}}
								required
								disabled={isSaving}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="edit-booking-date">Session date</Label>
							<Input
								id="edit-booking-date"
								name="date"
								type="date"
								autoComplete="off"
								value={draft.date}
								onChange={(event) => {
									setDraft((current) => ({ ...current, date: event.target.value }));
								}}
								required
								disabled={isSaving}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="edit-booking-time">Session time</Label>
							<Input
								id="edit-booking-time"
								name="time"
								type="time"
								autoComplete="off"
								value={draft.time}
								onChange={(event) => {
									setDraft((current) => ({ ...current, time: event.target.value }));
								}}
								required
								disabled={isSaving}
							/>
						</div>
					</section>

					<section className="grid gap-3">
						<Label>Service</Label>
						<RadioGroup
							value={draft.service}
							onValueChange={(value) => {
								setDraft((current) => ({
									...current,
									service: value as BookingRecord["service"],
								}));
							}}
							className="grid gap-3 sm:grid-cols-2">
							{SERVICES.map((service) => {
								const optionId = `edit-service-${toOptionId(service)}`;

								return (
									<label
										key={service}
										htmlFor={optionId}
										className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors has-checked:border-primary has-checked:bg-primary/5">
										<RadioGroupItem
											id={optionId}
											value={service}
											disabled={isSaving}
										/>
										<span className="font-medium">{service}</span>
									</label>
								);
							})}
						</RadioGroup>
					</section>

					<section className="grid gap-3">
						<Label>Add-ons</Label>
						<div className="grid gap-3">
							{ADDON_OPTIONS.map((addon) => {
								const optionId = `edit-addon-${toOptionId(addon)}`;
								const isChecked = draft.addons.includes(addon);

								return (
									<label
										key={addon}
										htmlFor={optionId}
										className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors has-checked:border-primary has-checked:bg-primary/5">
										<Checkbox
											id={optionId}
											checked={isChecked}
											disabled={isSaving}
											onCheckedChange={(checked) => {
												setDraft((current) => {
													const nextAddons = checked
														? [...current.addons, addon]
														: current.addons.filter((value) => value !== addon);

													return { ...current, addons: nextAddons };
												});
											}}
										/>
										<span className="font-medium">{addon}</span>
									</label>
								);
							})}
						</div>
					</section>

					<div className="grid gap-2">
						<Label htmlFor="edit-booking-notes">Notes</Label>
						<Textarea
							id="edit-booking-notes"
							name="notes"
							autoComplete="off"
							value={draft.notes}
							onChange={(event) => {
								setDraft((current) => ({ ...current, notes: event.target.value }));
							}}
							placeholder="Optional"
							disabled={isSaving}
						/>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSaving}>
							Discard changes
						</Button>
						<Button
							type="submit"
							disabled={isSaving}>
							{isSaving ? "Saving..." : "I am sure I want to make permanent changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
