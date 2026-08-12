import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "#/components/ui/button";
import { AdminAddonOptions } from "#studio/features/admin/components/AdminAddonOptions";
import { AdminEditingQuantityOptions } from "#studio/features/admin/components/AdminEditingQuantityOptions";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Textarea } from "#/components/ui/textarea";
import { cn } from "#/lib/utils";
import type { Doc } from "#convex/_generated/dataModel";
import {
	DURATION_OPTIONS,
	SERVICES,
	isAddonOption,
	toDeliverableCountOption,
	pickBookingAddonQuantities,
	type BookingAddonQuantities,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import { calculateBookingInvoiceAmounts } from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import { toAdminSessionDuration } from "#studio/features/admin/lib/admin-sessions";
import { formatAudAmount } from "#studio/features/admin/lib/remaining-balance";
import { toOptionId } from "#studio/lib/bookingdatetime";
import { X } from "lucide-react";

type SessionRecord = Doc<"bookings">;

export type SessionEditDraft = {
	accountName: string;
	addons: BookingFormValues["addons"];
	abn: string;
	date: string;
} & BookingAddonQuantities & {
		duration: BookingFormValues["duration"];
		email: string;
		name: string;
		notes: string;
		phone: string;
		service: SessionRecord["service"];
		remainingBalanceAmount: string;
		time: string;
	};

export type SessionEditDialogProps = {
	open: boolean;
	session: SessionRecord;
	bookingId: string;
	onOpenChange: (open: boolean) => void;
	onSave: (values: SessionEditDraft) => Promise<void>;
	isSaving: boolean;
};

function buildSessionEditDraft(session: SessionRecord): SessionEditDraft {
	return {
		name: session.name,
		accountName: session.accountName,
		abn: session.abn ?? "",
		date: session.date,
		essentialEditQuantity: toDeliverableCountOption(session.essentialEditQuantity),
		completeEditQuantity: toDeliverableCountOption(session.completeEditQuantity),
		clipsPackageQuantity: toDeliverableCountOption(session.clipsPackageQuantity),
		handcraftedClipsQuantity: toDeliverableCountOption(session.handcraftedClipsQuantity),
		time: session.time,
		duration: toAdminSessionDuration(session.duration),
		service: session.service,
		addons: session.addons.filter(isAddonOption),
		email: session.email,
		phone: session.phone,
		notes: session.notes ?? "",
		remainingBalanceAmount: session.remainingBalanceAmount?.toString() ?? ""
	};
}

export function SessionEditDialog({
	open,
	session,
	bookingId,
	onOpenChange,
	onSave,
	isSaving
}: SessionEditDialogProps) {
	const [draft, setDraft] = useState<SessionEditDraft>(() => buildSessionEditDraft(session));
	const defaultRemainingBalanceAmount = calculateBookingInvoiceAmounts({
		duration: draft.duration,
		addons: draft.addons,
		...pickBookingAddonQuantities(draft)
	}).totalDueAmount;

	useEffect(() => {
		if (open) {
			setDraft(buildSessionEditDraft(session));
		}
	}, [session, open]);

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
				className={cn("flex max-h-dvh flex-col", "overflow-hidden", "sm:max-w-4xl")}
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
						aria-label="Close edit session dialog"
						disabled={isSaving}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="text-left">
					<DialogTitle>Edit session</DialogTitle>
					<DialogDescription>
						This will make changes to session {bookingId}. There is no turning back from this. USE
						CAUTION.
					</DialogDescription>
				</DialogHeader>

				<form
					className={cn(
						"flex min-h-0 flex-col gap-6",
						"overflow-y-auto overscroll-contain",
						"pr-4"
					)}
					data-lenis-prevent
					onSubmit={(event) => {
						event.preventDefault();
						void onSave(draft);
					}}>
					<section className="grid gap-4 md:grid-cols-2">
						<div className="grid gap-2">
							<Label htmlFor="edit-session-name">Customer name</Label>
							<Input
								id="edit-session-name"
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
							<Label htmlFor="edit-session-account-name">Account name</Label>
							<Input
								id="edit-session-account-name"
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
							<Label htmlFor="edit-session-abn">ABN</Label>
							<Input
								id="edit-session-abn"
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
							<Label htmlFor="edit-session-email">Email</Label>
							<Input
								id="edit-session-email"
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
							<Label htmlFor="edit-session-phone">Phone number</Label>
							<Input
								id="edit-session-phone"
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
							<Label htmlFor="edit-session-date">Session date</Label>
							<Input
								id="edit-session-date"
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
							<Label htmlFor="edit-session-time">Session time</Label>
							<Input
								id="edit-session-time"
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
						<Label>Session duration</Label>
						<RadioGroup
							value={draft.duration}
							onValueChange={(value) => {
								const duration = DURATION_OPTIONS.find((option) => option === value);

								if (duration) {
									setDraft((current) => ({ ...current, duration }));
								}
							}}
							className="grid gap-3 sm:grid-cols-3">
							{DURATION_OPTIONS.map((duration) => {
								const optionId = `edit-duration-${toOptionId(duration)}`;

								return (
									<label
										key={duration}
										htmlFor={optionId}
										className={cn(
											"flex cursor-pointer items-center gap-3",
											"p-3",
											"rounded-lg border",
											"transition-colors",
											"has-checked:border-primary has-checked:bg-primary/5"
										)}>
										<RadioGroupItem
											id={optionId}
											value={duration}
											disabled={isSaving}
										/>
										<span className="font-medium">{duration}</span>
									</label>
								);
							})}
						</RadioGroup>
					</section>

					<section className="grid gap-3">
						<Label>Service</Label>
						<RadioGroup
							value={draft.service}
							onValueChange={(value) => {
								setDraft((current) => ({ ...current, service: value }));
							}}
							className="grid gap-3 sm:grid-cols-2">
							{SERVICES.map((service) => {
								const optionId = `edit-service-${toOptionId(service)}`;

								return (
									<label
										key={service}
										htmlFor={optionId}
										className={cn(
											"flex cursor-pointer items-center gap-3",
											"p-3",
											"rounded-lg border",
											"transition-colors",
											"has-checked:border-primary has-checked:bg-primary/5"
										)}>
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

					<AdminAddonOptions
						addons={draft.addons}
						essentialEditQuantity={draft.essentialEditQuantity}
						completeEditQuantity={draft.completeEditQuantity}
						clipsPackageQuantity={draft.clipsPackageQuantity}
						handcraftedClipsQuantity={draft.handcraftedClipsQuantity}
						disabled={isSaving}
						idPrefix="edit-addon"
						onChange={(nextValues) => {
							setDraft((current) => ({ ...current, ...nextValues }));
						}}
					/>

					{draft.addons.includes("Essential Edit") ? (
						<AdminEditingQuantityOptions
							idPrefix="edit-essential-edit-quantity"
							label="Essential Edit quantity"
							value={draft.essentialEditQuantity ?? ""}
							disabled={isSaving}
							onChange={(value) => {
								setDraft((current) => ({ ...current, essentialEditQuantity: value }));
							}}
						/>
					) : null}
					{draft.addons.includes("Complete Edit") ? (
						<AdminEditingQuantityOptions
							idPrefix="edit-complete-edit-quantity"
							label="Complete Edit quantity"
							value={draft.completeEditQuantity ?? ""}
							disabled={isSaving}
							onChange={(value) => {
								setDraft((current) => ({ ...current, completeEditQuantity: value }));
							}}
						/>
					) : null}
					{draft.addons.includes("Clip Volume Pack") ? (
						<AdminEditingQuantityOptions
							idPrefix="edit-clips-package-quantity"
							label="Clip Volume Pack quantity"
							value={draft.clipsPackageQuantity ?? ""}
							disabled={isSaving}
							onChange={(value) => {
								setDraft((current) => ({ ...current, clipsPackageQuantity: value }));
							}}
						/>
					) : null}
					{draft.addons.includes("Handcrafted Clips") ? (
						<AdminEditingQuantityOptions
							idPrefix="edit-handcrafted-clips-quantity"
							label="Handcrafted Clips quantity"
							value={draft.handcraftedClipsQuantity ?? ""}
							disabled={isSaving}
							onChange={(value) => {
								setDraft((current) => ({ ...current, handcraftedClipsQuantity: value }));
							}}
						/>
					) : null}

					<section className="grid gap-2">
						<Label htmlFor="edit-session-remaining-balance">Remaining balance due</Label>
						<Input
							id="edit-session-remaining-balance"
							name="remainingBalanceAmount"
							type="number"
							inputMode="decimal"
							min="0"
							step="0.01"
							value={draft.remainingBalanceAmount}
							onChange={(event) => {
								setDraft((current) => ({ ...current, remainingBalanceAmount: event.target.value }));
							}}
							placeholder={defaultRemainingBalanceAmount.toFixed(2)}
							disabled={isSaving}
						/>
						<p className="text-muted-foreground text-sm">
							Leave blank to use the current default:{" "}
							{formatAudAmount(defaultRemainingBalanceAmount)}.
						</p>
					</section>

					<div className="grid gap-2">
						<Label htmlFor="edit-session-notes">Client notes</Label>
						<Textarea
							id="edit-session-notes"
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
							{isSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
							{isSaving ? "Saving..." : "I am sure I want to make permanent changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
