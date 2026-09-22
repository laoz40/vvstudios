import { useMemo } from "react";
import { Store, useSelector } from "@tanstack/react-store";
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
import {
	DURATION_OPTIONS,
	pickBookingAddonQuantities
} from "#studio/features/booking-form/lib/booking-form-model";
import {
	calculatePackageAmounts,
	isPackageSize,
	PACKAGE_PLANS
} from "#studio/features/booking-form/lib/booking-pricing";
import {
	adminOptionButtonClassName,
	adminOptionRowClassName
} from "#studio/features/admin/lib/admin-form-styles";
import {
	formatAudAmount,
	getAudAmountRowShowCents
} from "#studio/features/admin/lib/remaining-balance";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import { usePackageEditPricingValues } from "#studio/features/admin/hooks/usePackageEditPricingValues";
import {
	PackageEditDraftStoreContext,
	buildPackageEditDraft,
	setPackageEditDraftField,
	usePackageEditDraftStore,
	type PackageEditDraft
} from "#studio/features/admin/lib/package-edit-draft-store";
import { toOptionId } from "#studio/lib/bookingdatetime";

export type { PackageEditDraft } from "#studio/features/admin/lib/package-edit-draft-store";

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

function getPackageDraftTotal(draft: PackageEditDraft) {
	return calculatePackageAmounts({
		addons: draft.addons,
		duration: draft.duration,
		packageSize: draft.packageSize,
		...pickBookingAddonQuantities(draft)
	}).totalDueAmount;
}

type PackageEditFieldProps = { isSaving: boolean };

function PackageEditCustomerNameField({ isSaving }: PackageEditFieldProps) {
	const store = usePackageEditDraftStore();
	const customerName = useSelector(store, (draft) => draft.customerName);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-package-name">Customer name</Label>
			<Input
				id="edit-package-name"
				name="customerName"
				autoComplete="name"
				value={customerName}
				onChange={(event) => {
					setPackageEditDraftField(store, "customerName", event.target.value);
				}}
				required
				disabled={isSaving}
			/>
		</div>
	);
}

function PackageEditAccountNameField({ isSaving }: PackageEditFieldProps) {
	const store = usePackageEditDraftStore();
	const accountName = useSelector(store, (draft) => draft.accountName);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-package-account-name">Account name</Label>
			<Input
				id="edit-package-account-name"
				name="accountName"
				autoComplete="organization"
				value={accountName}
				onChange={(event) => {
					setPackageEditDraftField(store, "accountName", event.target.value);
				}}
				required
				disabled={isSaving}
			/>
		</div>
	);
}

function PackageEditAbnField({ isSaving }: PackageEditFieldProps) {
	const store = usePackageEditDraftStore();
	const abn = useSelector(store, (draft) => draft.abn);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-package-abn">ABN</Label>
			<Input
				id="edit-package-abn"
				name="abn"
				autoComplete="off"
				spellCheck={false}
				value={abn}
				onChange={(event) => {
					setPackageEditDraftField(store, "abn", event.target.value);
				}}
				inputMode="numeric"
				placeholder="Optional"
				disabled={isSaving}
			/>
		</div>
	);
}

function PackageEditEmailField({ isSaving }: PackageEditFieldProps) {
	const store = usePackageEditDraftStore();
	const customerEmail = useSelector(store, (draft) => draft.customerEmail);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-package-email">Email</Label>
			<Input
				id="edit-package-email"
				name="customerEmail"
				type="email"
				autoComplete="email"
				spellCheck={false}
				value={customerEmail}
				onChange={(event) => {
					setPackageEditDraftField(store, "customerEmail", event.target.value);
				}}
				required
				disabled={isSaving}
			/>
		</div>
	);
}

function PackageEditPhoneField({ isSaving }: PackageEditFieldProps) {
	const store = usePackageEditDraftStore();
	const customerPhone = useSelector(store, (draft) => draft.customerPhone);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-package-phone">Phone number</Label>
			<Input
				id="edit-package-phone"
				name="customerPhone"
				type="tel"
				autoComplete="tel"
				inputMode="tel"
				value={customerPhone}
				onChange={(event) => {
					setPackageEditDraftField(store, "customerPhone", event.target.value);
				}}
				required
				disabled={isSaving}
			/>
		</div>
	);
}

function PackageEditNotesField({ isSaving }: PackageEditFieldProps) {
	const store = usePackageEditDraftStore();
	const notes = useSelector(store, (draft) => draft.notes);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-package-notes">Client notes</Label>
			<Textarea
				id="edit-package-notes"
				name="notes"
				autoComplete="off"
				rows={2}
				value={notes}
				onChange={(event) => {
					setPackageEditDraftField(store, "notes", event.target.value);
				}}
				placeholder="Optional"
				disabled={isSaving}
			/>
		</div>
	);
}

function PackageEditExpiresDateField({ isSaving }: PackageEditFieldProps) {
	const store = usePackageEditDraftStore();
	const expiresDate = useSelector(store, (draft) => draft.expiresDate);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-package-expires-date">Package expiry date</Label>
			<Input
				id="edit-package-expires-date"
				name="expiresDate"
				type="date"
				autoComplete="off"
				value={expiresDate}
				onChange={(event) => {
					setPackageEditDraftField(store, "expiresDate", event.target.value);
				}}
				required
				disabled={isSaving}
			/>
		</div>
	);
}

function PackageEditExpiresTimeField({ isSaving }: PackageEditFieldProps) {
	const store = usePackageEditDraftStore();
	const expiresTime = useSelector(store, (draft) => draft.expiresTime);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-package-expires-time">Package expiry time</Label>
			<Input
				id="edit-package-expires-time"
				name="expiresTime"
				type="time"
				autoComplete="off"
				value={expiresTime}
				onChange={(event) => {
					setPackageEditDraftField(store, "expiresTime", event.target.value);
				}}
				required
				disabled={isSaving}
			/>
		</div>
	);
}

function PackageEditPackageSizeField({ isSaving }: PackageEditFieldProps) {
	const store = usePackageEditDraftStore();
	const packageSize = useSelector(store, (draft) => draft.packageSize);

	return (
		<div className="grid gap-2">
			<Label>Package sessions</Label>
			<RadioGroup
				value={String(packageSize)}
				onValueChange={(value) => {
					const nextPackageSize = Number(value);

					if (isPackageSize(nextPackageSize)) {
						setPackageEditDraftField(store, "packageSize", nextPackageSize);
					}
				}}
				className={adminOptionRowClassName}>
				{Object.keys(PACKAGE_PLANS)
					.map(Number)
					.filter(isPackageSize)
					.map((optionPackageSize) => {
						const optionId = `edit-package-size-${optionPackageSize}`;

						return (
							<label
								key={optionPackageSize}
								htmlFor={optionId}
								className={adminOptionButtonClassName}>
								<RadioGroupItem
									id={optionId}
									value={String(optionPackageSize)}
									disabled={isSaving}
									className="sr-only"
								/>
								{optionPackageSize} sessions
							</label>
						);
					})}
			</RadioGroup>
		</div>
	);
}

function PackageEditDurationField({ isSaving }: PackageEditFieldProps) {
	const store = usePackageEditDraftStore();
	const duration = useSelector(store, (draft) => draft.duration);

	return (
		<div className="grid gap-2">
			<Label>Session duration</Label>
			<RadioGroup
				value={duration}
				onValueChange={(value) => {
					const nextDuration = DURATION_OPTIONS.find((option) => option === value);

					if (nextDuration) {
						setPackageEditDraftField(store, "duration", nextDuration);
					}
				}}
				className={adminOptionRowClassName}>
				{DURATION_OPTIONS.map((option) => {
					const optionId = `edit-package-duration-${toOptionId(option)}`;

					return (
						<label
							key={option}
							htmlFor={optionId}
							className={adminOptionButtonClassName}>
							<RadioGroupItem
								id={optionId}
								value={option}
								disabled={isSaving}
								className="sr-only"
							/>
							{option}
						</label>
					);
				})}
			</RadioGroup>
		</div>
	);
}

type PackageEditAddonValues = Pick<
	PackageEditDraft,
	| "addons"
	| "clipsPackageQuantity"
	| "completeEditQuantity"
	| "essentialEditQuantity"
	| "handcraftedClipsQuantity"
>;

function getPackageEditAddonValues(draft: PackageEditDraft): PackageEditAddonValues {
	return {
		addons: draft.addons,
		essentialEditQuantity: draft.essentialEditQuantity,
		completeEditQuantity: draft.completeEditQuantity,
		clipsPackageQuantity: draft.clipsPackageQuantity,
		handcraftedClipsQuantity: draft.handcraftedClipsQuantity
	};
}

function getPackageEditAddonValuesKey(values: PackageEditAddonValues): string {
	return [
		values.addons.join("\0"),
		values.essentialEditQuantity,
		values.completeEditQuantity,
		values.clipsPackageQuantity,
		values.handcraftedClipsQuantity
	].join("|");
}

function arePackageEditAddonValuesEqual(
	left: PackageEditAddonValues,
	right: PackageEditAddonValues
) {
	return getPackageEditAddonValuesKey(left) === getPackageEditAddonValuesKey(right);
}

function PackageEditAddonsSection({
	packageId,
	isSaving
}: {
	packageId: string;
	isSaving: boolean;
}) {
	const store = usePackageEditDraftStore();

	const addonValues = useSelector(store, (draft) => getPackageEditAddonValues(draft), {
		compare: arePackageEditAddonValuesEqual
	});

	return (
		<AdminAddonOptions
			key={packageId}
			addons={addonValues.addons}
			essentialEditQuantity={addonValues.essentialEditQuantity}
			completeEditQuantity={addonValues.completeEditQuantity}
			clipsPackageQuantity={addonValues.clipsPackageQuantity}
			handcraftedClipsQuantity={addonValues.handcraftedClipsQuantity}
			disabled={isSaving}
			idPrefix="edit-package-addon"
			showLabel={false}
			onChange={(nextValues) => {
				store.setState((current) => ({ ...current, ...nextValues }));
			}}
		/>
	);
}

function PackageEditPriceSummary({ originalPrice }: { originalPrice: number }) {
	const pricingValues = usePackageEditPricingValues();
	const newPrice = calculatePackageAmounts(pricingValues).totalDueAmount;
	const priceDifference = newPrice - originalPrice;
	const showPriceCents = getAudAmountRowShowCents([originalPrice, newPrice, priceDifference]);

	return (
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
	);
}

type PackageEditDialogFormProps = {
	isSaving: boolean;
	packageRow: AdminPackageRow;
	onOpenChange: (open: boolean) => void;
	onSave: (values: PackageEditDraft) => Promise<void>;
};

function PackageEditDialogForm({
	isSaving,
	packageRow,
	onOpenChange,
	onSave
}: PackageEditDialogFormProps) {
	const draftStore = useMemo(() => new Store(buildPackageEditDraft(packageRow)), [packageRow]);
	const originalPrice = getPackageDraftTotal(buildPackageEditDraft(packageRow));

	return (
		<PackageEditDraftStoreContext value={draftStore}>
			<form
				className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pr-1"
				data-lenis-prevent
				onSubmit={(event) => {
					event.preventDefault();
					void onSave(draftStore.state);
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
								<PackageEditCustomerNameField isSaving={isSaving} />
								<PackageEditAccountNameField isSaving={isSaving} />
								<PackageEditAbnField isSaving={isSaving} />
								<PackageEditEmailField isSaving={isSaving} />
								<PackageEditPhoneField isSaving={isSaving} />
							</div>
							<PackageEditNotesField isSaving={isSaving} />
						</AccordionContent>
					</AccordionItem>

					<AccordionItem value="package-details">
						<AccordionTrigger className={accordionTriggerClassName}>
							Package details
						</AccordionTrigger>
						<AccordionContent className={accordionContentClassName}>
							<div className="grid gap-3 sm:grid-cols-2">
								<PackageEditExpiresDateField isSaving={isSaving} />
								<PackageEditExpiresTimeField isSaving={isSaving} />
							</div>

							<div className="grid gap-3 sm:grid-cols-2">
								<PackageEditPackageSizeField isSaving={isSaving} />
								<PackageEditDurationField isSaving={isSaving} />
							</div>
						</AccordionContent>
					</AccordionItem>

					<AccordionItem value="addons">
						<AccordionTrigger className={accordionTriggerClassName}>Add-ons</AccordionTrigger>
						<AccordionContent className={accordionContentClassName}>
							<PackageEditAddonsSection
								packageId={packageRow.id}
								isSaving={isSaving}
							/>
						</AccordionContent>
					</AccordionItem>
				</Accordion>

				<PackageEditPriceSummary originalPrice={originalPrice} />

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
		</PackageEditDraftStoreContext>
	);
}

export function PackageEditDialog({
	open,
	isSaving,
	packageRow,
	onOpenChange,
	onSave
}: PackageEditDialogProps) {
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

				{open ? (
					<PackageEditDialogForm
						key={packageRow.id}
						isSaving={isSaving}
						packageRow={packageRow}
						onOpenChange={onOpenChange}
						onSave={onSave}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
