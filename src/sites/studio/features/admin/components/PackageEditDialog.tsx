import { useEffect, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
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
	ADDON_OPTIONS,
	DELIVERABLE_COUNT_OPTIONS,
	DURATION_OPTIONS,
	SERVICES,
	toDeliverableCountOption,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	MULTI_BOOKING_PLANS,
	type MultiBookingSize
} from "#studio/features/booking-form/lib/booking-pricing";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import { toOptionId } from "#studio/lib/bookingdatetime";

export type PackageEditDraft = {
	accountName: string;
	addons: BookingFormValues["addons"];
	abn: string;
	clipsPackageQuantity: BookingFormValues["clipsPackageQuantity"];
	customerEmail: string;
	customerName: string;
	customerPhone: string;
	duration: BookingFormValues["duration"];
	essentialEditQuantity: BookingFormValues["essentialEditQuantity"];
	expiresAt?: number;
	notes: string;
	packageSize: MultiBookingSize;
	service: AdminPackageRow["service"] | "";
};

type PackageEditDialogProps = {
	open: boolean;
	isSaving: boolean;
	packageRow: AdminPackageRow;
	onOpenChange: (open: boolean) => void;
	onSave: (values: PackageEditDraft) => Promise<void>;
};

type EditingQuantityOptionsProps = {
	disabled: boolean;
	idPrefix: string;
	label: string;
	onChange: (value: BookingFormValues["essentialEditQuantity"]) => void;
	value: string;
};

function isAddonOption(value: string): value is BookingFormValues["addons"][number] {
	return ADDON_OPTIONS.includes(value as BookingFormValues["addons"][number]);
}

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
		addons: packageRow.addons.filter(isAddonOption),
		abn: packageRow.abn ?? "",
		clipsPackageQuantity: toDeliverableCountOption(packageRow.clipsPackageQuantity),
		customerEmail: packageRow.customerEmail,
		customerName: packageRow.customerName,
		customerPhone: packageRow.customerPhone,
		duration: packageRow.duration as BookingFormValues["duration"],
		essentialEditQuantity: toDeliverableCountOption(packageRow.essentialEditQuantity),
		expiresAt: packageRow.expiresAt,
		notes: packageRow.notes ?? "",
		packageSize: packageRow.packageSize,
		service: packageRow.service
	};
}

function EditingQuantityOptions({
	disabled,
	idPrefix,
	label,
	onChange,
	value
}: EditingQuantityOptionsProps) {
	return (
		<section className="grid gap-3">
			<Label>{label}</Label>
			<RadioGroup
				value={value}
				onValueChange={(nextValue) =>
					onChange(nextValue as BookingFormValues["essentialEditQuantity"])
				}
				className="grid gap-3 sm:grid-cols-4">
				{DELIVERABLE_COUNT_OPTIONS.map((count) => {
					const optionId = `${idPrefix}-${count}`;

					return (
						<label
							key={count}
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
								value={count}
								disabled={disabled}
							/>
							<span className="font-medium">{count}</span>
						</label>
					);
				})}
			</RadioGroup>
		</section>
	);
}

export function PackageEditDialog({
	open,
	isSaving,
	packageRow,
	onOpenChange,
	onSave
}: PackageEditDialogProps) {
	const [draft, setDraft] = useState<PackageEditDraft>(() => buildPackageEditDraft(packageRow));

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
							onValueChange={(value) =>
								setDraft((current) => ({
									...current,
									packageSize: Number(value) as MultiBookingSize
								}))
							}
							className="grid gap-3 sm:grid-cols-3">
							{Object.keys(MULTI_BOOKING_PLANS).map((packageSize) => {
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
											value={packageSize}
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
							onValueChange={(value) =>
								setDraft((current) => ({
									...current,
									duration: value as BookingFormValues["duration"]
								}))
							}
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

					<section className="grid gap-3">
						<Label>Service</Label>
						<RadioGroup
							value={draft.service}
							onValueChange={(value) =>
								setDraft((current) => ({
									...current,
									service: value as AdminPackageRow["service"]
								}))
							}
							className="grid gap-3 sm:grid-cols-2">
							{SERVICES.map((service) => {
								const optionId = `edit-package-service-${toOptionId(service)}`;

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
						clipsPackageQuantity={draft.clipsPackageQuantity}
						disabled={isSaving}
						idPrefix="edit-package-addon"
						onChange={(nextValues) => setDraft((current) => ({ ...current, ...nextValues }))}
					/>

					{draft.addons.includes("Essential Edit") ? (
						<EditingQuantityOptions
							idPrefix="edit-package-essential-edit-quantity"
							label="Essential Edit quantity"
							value={draft.essentialEditQuantity ?? ""}
							disabled={isSaving}
							onChange={(value) =>
								setDraft((current) => ({ ...current, essentialEditQuantity: value }))
							}
						/>
					) : null}
					{draft.addons.includes("Clips Package") ? (
						<EditingQuantityOptions
							idPrefix="edit-package-clips-package-quantity"
							label="Clips Package quantity"
							value={draft.clipsPackageQuantity ?? ""}
							disabled={isSaving}
							onChange={(value) =>
								setDraft((current) => ({ ...current, clipsPackageQuantity: value }))
							}
						/>
					) : null}

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
