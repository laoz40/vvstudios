import { useEffect, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from "#/components/ui/accordion";
import { Button } from "#/components/ui/button";
import { AdminAddonOptions } from "#studio/features/admin/components/AdminAddonOptions";
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
import type { Doc } from "#convex/_generated/dataModel";
import {
	DURATION_OPTIONS,
	SERVICES,
	toDeliverableCountOption,
	type BookingAddonQuantities,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	adminOptionButtonClassName,
	adminOptionRowClassName
} from "#studio/features/admin/lib/admin-form-styles";
import { toAdminSessionDuration } from "#studio/features/admin/lib/admin-sessions";
import {
	formatAudAmount,
	getAudAmountRowShowCents
} from "#studio/features/admin/lib/remaining-balance";
import { getBookingTotal } from "#studio/features/booking-form/lib/booking-pricing";
import { toOptionId } from "#studio/lib/bookingdatetime";

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

const compactFieldClassName = "grid gap-1.5";

const accordionTriggerClassName = "!py-3 !text-base !font-bold hover:!text-primary";

const accordionContentClassName = "space-y-3 pb-3 pt-1 text-sm md:text-sm md:pb-3";

function formatSignedPriceDifference(diff: number, showCents: boolean) {
	const sign = diff > 0 ? "+" : "-";

	return `(${sign}${formatAudAmount(Math.abs(diff), { showCents })})`;
}

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
		addons: [...session.addons],
		email: session.email,
		phone: session.phone,
		notes: session.notes ?? ""
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
	const originalPrice = getBookingTotal(buildSessionEditDraft(session));
	const newPrice = getBookingTotal(draft);
	const priceDifference = newPrice - originalPrice;
	const showPriceCents = getAudAmountRowShowCents([originalPrice, newPrice, priceDifference]);

	// Reset draft when dialog opens with fresh session data.
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
				className="flex max-h-dvh flex-col gap-4 overflow-hidden sm:max-w-3xl"
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

				<DialogHeader className="space-y-1 text-left">
					<DialogTitle>Edit session</DialogTitle>
					<DialogDescription>
						This will make changes to session {bookingId}. There is no turning back from this. USE
						CAUTION.
					</DialogDescription>
				</DialogHeader>

				<form
					className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pr-1"
					data-lenis-prevent
					onSubmit={(event) => {
						event.preventDefault();
						void onSave(draft);
					}}>
					<Accordion
						type="single"
						collapsible
						className="w-full">
						<AccordionItem value="client-details">
							<AccordionTrigger className={accordionTriggerClassName}>
								Client details
							</AccordionTrigger>
							<AccordionContent className={accordionContentClassName}>
								<div className="grid gap-3 sm:grid-cols-2">
									<div className={compactFieldClassName}>
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
									<div className={compactFieldClassName}>
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
									<div className={compactFieldClassName}>
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
									<div className={compactFieldClassName}>
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
									<div className={compactFieldClassName}>
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
								</div>
								<div className={compactFieldClassName}>
									<Label htmlFor="edit-session-notes">Client notes</Label>
									<Textarea
										id="edit-session-notes"
										name="notes"
										autoComplete="off"
										rows={2}
										value={draft.notes}
										onChange={(event) => {
											setDraft((current) => ({ ...current, notes: event.target.value }));
										}}
										placeholder="Optional"
										disabled={isSaving}
									/>
								</div>
							</AccordionContent>
						</AccordionItem>

						<AccordionItem value="session-details">
							<AccordionTrigger className={accordionTriggerClassName}>
								Session details
							</AccordionTrigger>
							<AccordionContent className={accordionContentClassName}>
								<div className="grid gap-3 sm:grid-cols-2">
									<div className={compactFieldClassName}>
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
									<div className={compactFieldClassName}>
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
								</div>

								<div className="grid gap-3 sm:grid-cols-2">
									<div className="grid gap-2">
										<Label>Session duration</Label>
										<RadioGroup
											value={draft.duration}
											onValueChange={(value) => {
												const duration = DURATION_OPTIONS.find((option) => option === value);

												if (duration) {
													setDraft((current) => ({ ...current, duration }));
												}
											}}
											className={adminOptionRowClassName}>
											{DURATION_OPTIONS.map((duration) => {
												const optionId = `edit-duration-${toOptionId(duration)}`;

												return (
													<label
														key={duration}
														htmlFor={optionId}
														className={adminOptionButtonClassName}>
														<RadioGroupItem
															id={optionId}
															value={duration}
															disabled={isSaving}
															className="sr-only"
														/>
														{duration}
													</label>
												);
											})}
										</RadioGroup>
									</div>

									<div className="grid gap-2">
										<Label>Service</Label>
										<RadioGroup
											value={draft.service}
											onValueChange={(value) => {
												setDraft((current) => ({ ...current, service: value }));
											}}
											className={adminOptionRowClassName}>
											{SERVICES.map((service) => {
												const optionId = `edit-service-${toOptionId(service)}`;

												return (
													<label
														key={service}
														htmlFor={optionId}
														className={adminOptionButtonClassName}>
														<RadioGroupItem
															id={optionId}
															value={service}
															disabled={isSaving}
															className="sr-only"
														/>
														{service}
													</label>
												);
											})}
										</RadioGroup>
									</div>
								</div>
							</AccordionContent>
						</AccordionItem>

						<AccordionItem value="addons">
							<AccordionTrigger className={accordionTriggerClassName}>Add-ons</AccordionTrigger>
							<AccordionContent className={accordionContentClassName}>
								<AdminAddonOptions
									key={open ? bookingId : "closed"}
									addons={draft.addons}
									essentialEditQuantity={draft.essentialEditQuantity}
									completeEditQuantity={draft.completeEditQuantity}
									clipsPackageQuantity={draft.clipsPackageQuantity}
									handcraftedClipsQuantity={draft.handcraftedClipsQuantity}
									disabled={isSaving}
									idPrefix="edit-addon"
									showLabel={false}
									onChange={(nextValues) => {
										setDraft((current) => ({ ...current, ...nextValues }));
									}}
								/>
							</AccordionContent>
						</AccordionItem>
					</Accordion>

					<div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t pt-3 text-sm tabular-nums">
						<p>
							Total:{" "}
							<span className="font-medium">
								{formatAudAmount(originalPrice, { showCents: showPriceCents })}
							</span>
						</p>
						{priceDifference !== 0 ? (
							<p>
								New:{" "}
								<span className="font-medium">
									{formatAudAmount(newPrice, { showCents: showPriceCents })}
								</span>{" "}
								<span className="text-muted-foreground">
									{formatSignedPriceDifference(priceDifference, showPriceCents)}
								</span>
							</p>
						) : null}
					</div>

					<DialogFooter className="gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSaving}>
							Discard changes
						</Button>
						<Button
							type="submit"
							variant="destructive"
							disabled={isSaving}>
							{isSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
							{isSaving ? "Saving" : "I am sure I want to make permanent changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
