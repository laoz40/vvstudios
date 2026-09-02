import { useEffect, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
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
import {
	DURATION_OPTIONS,
	toDeliverableCountOption,
	pickBookingAddonQuantities,
	type BookingAddonQuantities,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	calculatePackageAmounts,
	isMultiBookingSize,
	MULTI_BOOKING_PLANS,
	type MultiBookingSize
} from "#studio/features/booking-form/lib/booking-pricing";
import {
	toAdminSessionAddons,
	toAdminSessionDuration
} from "#studio/features/admin/lib/admin-sessions";
import { formatAudAmount } from "#studio/features/admin/lib/remaining-balance";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import { toOptionId } from "#studio/lib/bookingdatetime";

export type PackageEditDraft = {
	accountName: string;
	addons: BookingFormValues["addons"];
	abn: string;
	customerEmail: string;
	customerName: string;
	customerPhone: string;
	duration: BookingFormValues["duration"];
	expiresAt?: number;
	notes: string;
	totalDueAmount: string;
	packageSize: MultiBookingSize;
} & BookingAddonQuantities;

type PackageEditDialogProps = {
	open: boolean;
	isSaving: boolean;
	packageRow: AdminPackageRow;
	onOpenChange: (open: boolean) => void;
	onSave: (values: PackageEditDraft) => Promise<void>;
};

function formatDateTimeLocalValue(timestamp: number | undefined) {
	if (timestamp === undefined) {
		return "";
	}

	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");

	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateTimeLocalValue(value: string) {
	if (!value) {
		return undefined;
	}

	const timestamp = new Date(value).getTime();
	return Number.isFinite(timestamp) ? timestamp : undefined;
}

function buildPackageEditDraft(packageRow: AdminPackageRow): PackageEditDraft {
	return {
		accountName: packageRow.accountName,
		addons: toAdminSessionAddons(packageRow.addons),
		abn: packageRow.abn ?? "",
		clipsPackageQuantity: toDeliverableCountOption(packageRow.clipsPackageQuantity),
		completeEditQuantity: toDeliverableCountOption(packageRow.completeEditQuantity),
		customerEmail: packageRow.customerEmail,
		customerName: packageRow.customerName,
		customerPhone: packageRow.customerPhone,
		duration: toAdminSessionDuration(packageRow.duration),
		essentialEditQuantity: toDeliverableCountOption(packageRow.essentialEditQuantity),
		handcraftedClipsQuantity: toDeliverableCountOption(packageRow.handcraftedClipsQuantity),
		expiresAt: packageRow.expiresAt,
		notes: packageRow.notes ?? "",
		packageSize: packageRow.packageSize,
		totalDueAmount: ""
	};
}

export function PackageEditDialog({
	open,
	isSaving,
	packageRow,
	onOpenChange,
	onSave
}: PackageEditDialogProps) {
	const [draft, setDraft] = useState<PackageEditDraft>(() => buildPackageEditDraft(packageRow));
	const defaultTotalDueAmount = calculatePackageAmounts({
		addons: draft.addons,
		duration: draft.duration,
		packageSize: draft.packageSize,
		...pickBookingAddonQuantities(draft)
	}).totalDueAmount;

	useEffect(() => {
		if (!open) {
			return;
		}

		setDraft(buildPackageEditDraft(packageRow));
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
						aria-label="Close edit package dialog"
						disabled={isSaving}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="text-left">
					<DialogTitle>Edit package</DialogTitle>
					<DialogDescription>
						This will make permanent changes to this package. USE CAUTION.
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
							<Label htmlFor="edit-package-name">Customer name</Label>
							<Input
								id="edit-package-name"
								value={draft.customerName}
								onChange={(event) =>
									setDraft((current) => ({ ...current, customerName: event.target.value }))
								}
								required
								disabled={isSaving}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="edit-package-account-name">Account name</Label>
							<Input
								id="edit-package-account-name"
								value={draft.accountName}
								onChange={(event) =>
									setDraft((current) => ({ ...current, accountName: event.target.value }))
								}
								required
								disabled={isSaving}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="edit-package-abn">ABN</Label>
							<Input
								id="edit-package-abn"
								value={draft.abn}
								onChange={(event) =>
									setDraft((current) => ({ ...current, abn: event.target.value }))
								}
								inputMode="numeric"
								placeholder="Optional"
								disabled={isSaving}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="edit-package-email">Email</Label>
							<Input
								id="edit-package-email"
								type="email"
								value={draft.customerEmail}
								onChange={(event) =>
									setDraft((current) => ({ ...current, customerEmail: event.target.value }))
								}
								required
								disabled={isSaving}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="edit-package-phone">Phone number</Label>
							<Input
								id="edit-package-phone"
								type="tel"
								value={draft.customerPhone}
								onChange={(event) =>
									setDraft((current) => ({ ...current, customerPhone: event.target.value }))
								}
								required
								disabled={isSaving}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="edit-package-expires-at">Package expiry window</Label>
							<Input
								id="edit-package-expires-at"
								type="datetime-local"
								value={formatDateTimeLocalValue(draft.expiresAt)}
								onChange={(event) =>
									setDraft((current) => ({
										...current,
										expiresAt: parseDateTimeLocalValue(event.target.value)
									}))
								}
								disabled={isSaving}
							/>
						</div>
					</section>

					<section className="grid gap-3">
						<Label>Package sessions</Label>
						<RadioGroup
							value={String(draft.packageSize)}
							onValueChange={(value) => {
								const packageSize = Number(value);

								if (isMultiBookingSize(packageSize)) {
									setDraft((current) => ({ ...current, packageSize }));
								}
							}}
							className="grid gap-3 sm:grid-cols-3">
							{Object.keys(MULTI_BOOKING_PLANS)
								.map(Number)
								.filter(isMultiBookingSize)
								.map((packageSize) => {
									const optionId = `edit-package-size-${packageSize}`;

									return (
										<label
											key={packageSize}
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
												value={String(packageSize)}
												disabled={isSaving}
											/>
											<span className="font-medium">{packageSize} sessions</span>
										</label>
									);
								})}
						</RadioGroup>
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
								const optionId = `edit-package-duration-${toOptionId(duration)}`;

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

					<AdminAddonOptions
						addons={draft.addons}
						essentialEditQuantity={draft.essentialEditQuantity}
						completeEditQuantity={draft.completeEditQuantity}
						clipsPackageQuantity={draft.clipsPackageQuantity}
						handcraftedClipsQuantity={draft.handcraftedClipsQuantity}
						disabled={isSaving}
						idPrefix="edit-package-addon"
						onChange={(nextValues) => setDraft((current) => ({ ...current, ...nextValues }))}
					/>

					{draft.addons.includes("Essential Edit") ? (
						<AdminEditingQuantityOptions
							idPrefix="edit-package-essential-edit-quantity"
							label="Essential Edit quantity"
							value={draft.essentialEditQuantity ?? ""}
							disabled={isSaving}
							onChange={(value) =>
								setDraft((current) => ({ ...current, essentialEditQuantity: value }))
							}
						/>
					) : null}
					{draft.addons.includes("Complete Edit") ? (
						<AdminEditingQuantityOptions
							idPrefix="edit-package-complete-edit-quantity"
							label="Complete Edit quantity"
							value={draft.completeEditQuantity ?? ""}
							disabled={isSaving}
							onChange={(value) =>
								setDraft((current) => ({ ...current, completeEditQuantity: value }))
							}
						/>
					) : null}
					{draft.addons.includes("Clip Volume Pack") ? (
						<AdminEditingQuantityOptions
							idPrefix="edit-package-clips-package-quantity"
							label="Clip Volume Pack quantity"
							value={draft.clipsPackageQuantity ?? ""}
							disabled={isSaving}
							onChange={(value) =>
								setDraft((current) => ({ ...current, clipsPackageQuantity: value }))
							}
						/>
					) : null}
					{draft.addons.includes("Handcrafted Clips") ? (
						<AdminEditingQuantityOptions
							idPrefix="edit-package-handcrafted-clips-quantity"
							label="Handcrafted Clips quantity"
							value={draft.handcraftedClipsQuantity ?? ""}
							disabled={isSaving}
							onChange={(value) =>
								setDraft((current) => ({ ...current, handcraftedClipsQuantity: value }))
							}
						/>
					) : null}

					<section className="grid gap-2">
						<Label htmlFor="edit-package-total-due">Package total due</Label>
						<Input
							id="edit-package-total-due"
							type="number"
							inputMode="decimal"
							min="0"
							step="0.01"
							value={draft.totalDueAmount}
							onChange={(event) => {
								setDraft((current) => ({ ...current, totalDueAmount: event.target.value }));
							}}
							placeholder={defaultTotalDueAmount.toFixed(2)}
							disabled={isSaving}
						/>
						<p className="text-muted-foreground text-sm">
							Leave blank to use the current default: {formatAudAmount(defaultTotalDueAmount)}.
						</p>
					</section>

					<div className="grid gap-2">
						<Label htmlFor="edit-package-notes">Notes</Label>
						<Textarea
							id="edit-package-notes"
							value={draft.notes}
							onChange={(event) =>
								setDraft((current) => ({ ...current, notes: event.target.value }))
							}
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
