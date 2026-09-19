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
import { cn } from "#/lib/utils";
import {
	DURATION_OPTIONS,
	toDeliverableCountOption,
	pickBookingAddonQuantities,
	type BookingAddonQuantities,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	calculatePackageAmounts,
	isPackageSize,
	PACKAGE_PLANS,
	type PackageSize
} from "#studio/features/booking-form/lib/booking-pricing";
import {
	adminOptionButtonClassName,
	adminOptionRowClassName
} from "#studio/features/admin/lib/admin-form-styles";
import { toAdminSessionDuration } from "#studio/features/admin/lib/admin-sessions";
import {
	formatAudAmount,
	getAudAmountRowShowCents
} from "#studio/features/admin/lib/remaining-balance";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import { getSydneyDateValue, getSydneyTimeValue, toOptionId } from "#studio/lib/bookingdatetime";

export type PackageEditDraft = {
	accountName: string;
	addons: BookingFormValues["addons"];
	abn: string;
	customerEmail: string;
	customerName: string;
	customerPhone: string;
	duration: BookingFormValues["duration"];
	expiresDate: string;
	expiresTime: string;
	notes: string;
	packageSize: PackageSize;
} & BookingAddonQuantities;

type PackageEditDialogProps = {
	open: boolean;
	isSaving: boolean;
	packageRow: AdminPackageRow;
	onOpenChange: (open: boolean) => void;
	onSave: (values: PackageEditDraft) => Promise<void>;
};

const compactFieldClassName = "grid gap-1.5";

const accordionTriggerClassName = "!py-3 !text-base !font-bold hover:!text-primary";

const accordionContentClassName = "space-y-3 pb-3 pt-1 text-sm md:text-sm md:pb-3";

function formatSignedPriceDifference(diff: number, showCents: boolean) {
	const sign = diff > 0 ? "+" : "-";

	return `(${sign}${formatAudAmount(Math.abs(diff), { showCents })})`;
}

function buildPackageEditDraft(packageRow: AdminPackageRow): PackageEditDraft {
	return {
		accountName: packageRow.accountName,
		addons: [...packageRow.addons],
		abn: packageRow.abn ?? "",
		clipsPackageQuantity: toDeliverableCountOption(packageRow.clipsPackageQuantity),
		completeEditQuantity: toDeliverableCountOption(packageRow.completeEditQuantity),
		customerEmail: packageRow.customerEmail,
		customerName: packageRow.customerName,
		customerPhone: packageRow.customerPhone,
		duration: toAdminSessionDuration(packageRow.duration),
		essentialEditQuantity: toDeliverableCountOption(packageRow.essentialEditQuantity),
		handcraftedClipsQuantity: toDeliverableCountOption(packageRow.handcraftedClipsQuantity),
		expiresDate:
			packageRow.expiresAt === undefined ? "" : getSydneyDateValue(new Date(packageRow.expiresAt)),
		expiresTime: packageRow.expiresAt === undefined ? "" : getSydneyTimeValue(packageRow.expiresAt),
		notes: packageRow.notes ?? "",
		packageSize: packageRow.packageSize
	};
}

function getPackageDraftTotal(draft: PackageEditDraft) {
	return calculatePackageAmounts({
		addons: draft.addons,
		duration: draft.duration,
		packageSize: draft.packageSize,
		...pickBookingAddonQuantities(draft)
	}).totalDueAmount;
}

export function PackageEditDialog({
	open,
	isSaving,
	packageRow,
	onOpenChange,
	onSave
}: PackageEditDialogProps) {
	const [draft, setDraft] = useState<PackageEditDraft>(() => buildPackageEditDraft(packageRow));

	const originalPrice = packageRow.totalDueAmount;
	const newPrice = getPackageDraftTotal(draft);
	const priceDifference = newPrice - originalPrice;
	const showPriceCents = getAudAmountRowShowCents([originalPrice, newPrice, priceDifference]);

	// Reset draft when dialog opens with fresh package data.
	useEffect(() => {
		if (open) {
			setDraft(buildPackageEditDraft(packageRow));
		}
	}, [open, packageRow]);

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
				className={cn("flex max-h-dvh flex-col", "gap-4", "overflow-hidden", "sm:max-w-3xl")}
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
						aria-label="Close edit package dialog"
						disabled={isSaving}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="space-y-1 text-left">
					<DialogTitle>Edit package</DialogTitle>
					<DialogDescription>
						This will make changes to package {packageRow.invoiceNumber}. There is no turning back
						from this. USE CAUTION.
					</DialogDescription>
				</DialogHeader>

				<form
					className={cn(
						"flex min-h-0 flex-col gap-3",
						"overflow-y-auto overscroll-contain",
						"pr-1"
					)}
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
										<Label htmlFor="edit-package-name">Customer name</Label>
										<Input
											id="edit-package-name"
											name="customerName"
											autoComplete="name"
											value={draft.customerName}
											onChange={(event) => {
												setDraft((current) => ({ ...current, customerName: event.target.value }));
											}}
											required
											disabled={isSaving}
										/>
									</div>
									<div className={compactFieldClassName}>
										<Label htmlFor="edit-package-account-name">Account name</Label>
										<Input
											id="edit-package-account-name"
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
										<Label htmlFor="edit-package-abn">ABN</Label>
										<Input
											id="edit-package-abn"
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
										<Label htmlFor="edit-package-email">Email</Label>
										<Input
											id="edit-package-email"
											name="customerEmail"
											type="email"
											autoComplete="email"
											spellCheck={false}
											value={draft.customerEmail}
											onChange={(event) => {
												setDraft((current) => ({ ...current, customerEmail: event.target.value }));
											}}
											required
											disabled={isSaving}
										/>
									</div>
									<div className={compactFieldClassName}>
										<Label htmlFor="edit-package-phone">Phone number</Label>
										<Input
											id="edit-package-phone"
											name="customerPhone"
											type="tel"
											autoComplete="tel"
											inputMode="tel"
											value={draft.customerPhone}
											onChange={(event) => {
												setDraft((current) => ({ ...current, customerPhone: event.target.value }));
											}}
											required
											disabled={isSaving}
										/>
									</div>
								</div>
								<div className={compactFieldClassName}>
									<Label htmlFor="edit-package-notes">Client notes</Label>
									<Textarea
										id="edit-package-notes"
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

						<AccordionItem value="package-details">
							<AccordionTrigger className={accordionTriggerClassName}>
								Package details
							</AccordionTrigger>
							<AccordionContent className={accordionContentClassName}>
								<div className="grid gap-3 sm:grid-cols-2">
									<div className={compactFieldClassName}>
										<Label htmlFor="edit-package-expires-date">Package expiry date</Label>
										<Input
											id="edit-package-expires-date"
											name="expiresDate"
											type="date"
											autoComplete="off"
											value={draft.expiresDate}
											onChange={(event) => {
												setDraft((current) => ({ ...current, expiresDate: event.target.value }));
											}}
											required
											disabled={isSaving}
										/>
									</div>
									<div className={compactFieldClassName}>
										<Label htmlFor="edit-package-expires-time">Package expiry time</Label>
										<Input
											id="edit-package-expires-time"
											name="expiresTime"
											type="time"
											autoComplete="off"
											value={draft.expiresTime}
											onChange={(event) => {
												setDraft((current) => ({ ...current, expiresTime: event.target.value }));
											}}
											required
											disabled={isSaving}
										/>
									</div>
								</div>

								<div className="grid gap-3 sm:grid-cols-2">
									<div className="grid gap-2">
										<Label>Package sessions</Label>
										<RadioGroup
											value={String(draft.packageSize)}
											onValueChange={(value) => {
												const packageSize = Number(value);

												if (isPackageSize(packageSize)) {
													setDraft((current) => ({ ...current, packageSize }));
												}
											}}
											className={adminOptionRowClassName}>
											{Object.keys(PACKAGE_PLANS)
												.map(Number)
												.filter(isPackageSize)
												.map((packageSize) => {
													const optionId = `edit-package-size-${packageSize}`;

													return (
														<label
															key={packageSize}
															htmlFor={optionId}
															className={adminOptionButtonClassName}>
															<RadioGroupItem
																id={optionId}
																value={String(packageSize)}
																disabled={isSaving}
																className="sr-only"
															/>
															{packageSize} sessions
														</label>
													);
												})}
										</RadioGroup>
									</div>

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
												const optionId = `edit-package-duration-${toOptionId(duration)}`;

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
								</div>
							</AccordionContent>
						</AccordionItem>

						<AccordionItem value="addons">
							<AccordionTrigger className={accordionTriggerClassName}>Add-ons</AccordionTrigger>
							<AccordionContent className={accordionContentClassName}>
								<AdminAddonOptions
									key={open ? packageRow.id : "closed"}
									addons={draft.addons}
									essentialEditQuantity={draft.essentialEditQuantity}
									completeEditQuantity={draft.completeEditQuantity}
									clipsPackageQuantity={draft.clipsPackageQuantity}
									handcraftedClipsQuantity={draft.handcraftedClipsQuantity}
									disabled={isSaving}
									idPrefix="edit-package-addon"
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
