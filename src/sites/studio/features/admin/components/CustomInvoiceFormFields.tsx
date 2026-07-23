import { Checkbox } from "#/components/ui/checkbox";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { AdminAddonOptions } from "#studio/features/admin/components/AdminAddonOptions";
import {
	isMultiBookingSize,
	MULTI_BOOKING_PLANS,
	type MultiBookingSize
} from "#studio/features/booking-form/lib/booking-pricing";
import {
	DELIVERABLE_COUNT_OPTIONS,
	DURATION_OPTIONS,
	SERVICES,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import { toOptionId } from "#studio/lib/bookingdatetime";

export type CustomInvoiceFormDraft = {
	service?: BookingFormValues["service"] | "";
	duration: BookingFormValues["duration"] | "";
	addons: BookingFormValues["addons"];
	essentialEditQuantity: BookingFormValues["essentialEditQuantity"];
	clipsPackageQuantity: BookingFormValues["clipsPackageQuantity"];
	dueDate: string;
	customTotalDueAmount: string;
};

type CustomInvoiceFormFieldsProps<TDraft extends CustomInvoiceFormDraft> = {
	disabled: boolean;
	draft: TDraft;
	idPrefix: string;
	onDraftChange: (nextDraft: TDraft) => void;
	priceHelpText: string;
	showService?: boolean;
	deposit?: { checked: boolean; onChange: (checked: boolean) => void };
	packageSize?: { value: MultiBookingSize; onChange: (packageSize: MultiBookingSize) => void };
	packageDiscount?: { checked: boolean; onChange: (checked: boolean) => void };
};

type OptionCheckboxProps = {
	checked: boolean;
	disabled: boolean;
	id: string;
	label: string;
	onCheckedChange: (checked: boolean) => void;
};

type CustomInvoiceQuantityOptionsProps = {
	disabled: boolean;
	idPrefix: string;
	label: string;
	onChange: (value: BookingFormValues["essentialEditQuantity"]) => void;
	value: string;
};

const OPTION_LABEL_CLASS_NAME =
	"flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors has-checked:border-primary has-checked:bg-primary/5";

export function CustomInvoiceFormFields<TDraft extends CustomInvoiceFormDraft>({
	disabled,
	draft,
	idPrefix,
	onDraftChange,
	priceHelpText,
	showService = true,
	deposit,
	packageSize,
	packageDiscount
}: CustomInvoiceFormFieldsProps<TDraft>) {
	return (
		<>
			<DueDateField
				disabled={disabled}
				idPrefix={idPrefix}
				value={draft.dueDate}
				onChange={(dueDate) => onDraftChange({ ...draft, dueDate })}
			/>

			{packageSize ? (
				<PackageSizeOptions
					disabled={disabled}
					idPrefix={idPrefix}
					packageSize={packageSize.value}
					onChange={packageSize.onChange}
				/>
			) : null}

			<DurationOptions
				disabled={disabled}
				idPrefix={idPrefix}
				value={draft.duration}
				onChange={(duration) => onDraftChange({ ...draft, duration })}
			/>

			{showService ? (
				<ServiceOptions
					disabled={disabled}
					idPrefix={idPrefix}
					value={draft.service ?? ""}
					onChange={(service) => onDraftChange({ ...draft, service })}
				/>
			) : null}

			<AdminAddonOptions
				addons={draft.addons}
				essentialEditQuantity={draft.essentialEditQuantity}
				clipsPackageQuantity={draft.clipsPackageQuantity}
				disabled={disabled}
				idPrefix={`${idPrefix}-addon`}
				onChange={(nextValues) => {
					onDraftChange({ ...draft, ...nextValues });
				}}
			/>

			{draft.addons.includes("Essential Edit") ? (
				<CustomInvoiceQuantityOptions
					idPrefix={`${idPrefix}-essential-edit-quantity`}
					label="Essential Edit quantity"
					value={draft.essentialEditQuantity ?? ""}
					disabled={disabled}
					onChange={(essentialEditQuantity) => {
						onDraftChange({ ...draft, essentialEditQuantity });
					}}
				/>
			) : null}

			{draft.addons.includes("Clips Package") ? (
				<CustomInvoiceQuantityOptions
					idPrefix={`${idPrefix}-clips-package-quantity`}
					label="Clips Package quantity"
					value={draft.clipsPackageQuantity ?? ""}
					disabled={disabled}
					onChange={(clipsPackageQuantity) => {
						onDraftChange({ ...draft, clipsPackageQuantity });
					}}
				/>
			) : null}

			<PriceField
				disabled={disabled}
				helpText={priceHelpText}
				idPrefix={idPrefix}
				value={draft.customTotalDueAmount}
				onChange={(customTotalDueAmount) => onDraftChange({ ...draft, customTotalDueAmount })}
			/>

			{packageDiscount ? (
				<PackageDiscountOption
					checked={packageDiscount.checked}
					disabled={disabled}
					idPrefix={idPrefix}
					onChange={packageDiscount.onChange}
				/>
			) : null}

			{deposit ? (
				<DepositOption
					checked={deposit.checked}
					disabled={disabled}
					idPrefix={idPrefix}
					onChange={deposit.onChange}
				/>
			) : null}
		</>
	);
}

function OptionCheckbox({ checked, disabled, id, label, onCheckedChange }: OptionCheckboxProps) {
	return (
		<label
			htmlFor={id}
			className={OPTION_LABEL_CLASS_NAME}>
			<Checkbox
				id={id}
				checked={checked}
				disabled={disabled}
				onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
			/>
			<span className="font-medium">{label}</span>
		</label>
	);
}

function DueDateField({
	disabled,
	idPrefix,
	onChange,
	value
}: {
	disabled: boolean;
	idPrefix: string;
	onChange: (value: string) => void;
	value: string;
}) {
	return (
		<section className="grid gap-3">
			<Label htmlFor={`${idPrefix}-due-date`}>Due date</Label>
			<Input
				id={`${idPrefix}-due-date`}
				type="date"
				value={value}
				disabled={disabled}
				required
				onChange={(event) => onChange(event.target.value)}
			/>
		</section>
	);
}

function PackageSizeOptions({
	disabled,
	idPrefix,
	onChange,
	packageSize
}: {
	disabled: boolean;
	idPrefix: string;
	onChange: (value: MultiBookingSize) => void;
	packageSize: MultiBookingSize;
}) {
	const packageSizeOptions = Object.keys(MULTI_BOOKING_PLANS)
		.map(Number)
		.filter(isMultiBookingSize);

	return (
		<section className="grid gap-3">
			<Label>Package size</Label>
			<div className="grid gap-3 sm:grid-cols-3">
				{packageSizeOptions.map((option) => (
					<OptionCheckbox
						key={option}
						id={`${idPrefix}-size-${option}`}
						checked={packageSize === option}
						disabled={disabled}
						label={`${option} sessions`}
						onCheckedChange={(checked) => {
							if (checked) {
								onChange(option);
							}
						}}
					/>
				))}
			</div>
		</section>
	);
}

function DurationOptions({
	disabled,
	idPrefix,
	onChange,
	value
}: {
	disabled: boolean;
	idPrefix: string;
	onChange: (value: BookingFormValues["duration"] | "") => void;
	value: BookingFormValues["duration"] | "";
}) {
	return (
		<section className="grid gap-3">
			<Label>Session duration</Label>
			<div className="grid gap-3 sm:grid-cols-3">
				{DURATION_OPTIONS.map((duration) => (
					<OptionCheckbox
						key={duration}
						id={`${idPrefix}-duration-${toOptionId(duration)}`}
						checked={value === duration}
						disabled={disabled}
						label={duration}
						onCheckedChange={(checked) => {
							onChange(checked ? duration : "");
						}}
					/>
				))}
			</div>
		</section>
	);
}

function ServiceOptions({
	disabled,
	idPrefix,
	onChange,
	value
}: {
	disabled: boolean;
	idPrefix: string;
	onChange: (value: BookingFormValues["service"] | "") => void;
	value: BookingFormValues["service"] | "";
}) {
	return (
		<section className="grid gap-3">
			<Label>Service</Label>
			<div className="grid gap-3 sm:grid-cols-2">
				{SERVICES.map((service) => (
					<OptionCheckbox
						key={service}
						id={`${idPrefix}-service-${toOptionId(service)}`}
						checked={value === service}
						disabled={disabled}
						label={service}
						onCheckedChange={(checked) => onChange(checked ? service : "")}
					/>
				))}
			</div>
		</section>
	);
}

function CustomInvoiceQuantityOptions({
	disabled,
	idPrefix,
	label,
	onChange,
	value
}: CustomInvoiceQuantityOptionsProps) {
	return (
		<section className="grid gap-3">
			<Label>{label}</Label>
			<div className="grid gap-3 sm:grid-cols-4">
				{DELIVERABLE_COUNT_OPTIONS.map((count) => (
					<OptionCheckbox
						key={count}
						id={`${idPrefix}-${count}`}
						checked={value === count}
						disabled={disabled}
						label={count}
						onCheckedChange={(checked) => {
							if (checked) {
								onChange(count);
							}
						}}
					/>
				))}
			</div>
		</section>
	);
}

function PackageDiscountOption({
	checked,
	disabled,
	idPrefix,
	onChange
}: {
	checked: boolean;
	disabled: boolean;
	idPrefix: string;
	onChange: (checked: boolean) => void;
}) {
	return (
		<section className="grid gap-3">
			<Label>Package discount</Label>
			<OptionCheckbox
				id={`${idPrefix}-include-package-discount`}
				checked={checked}
				disabled={disabled}
				label="Include package discount"
				onCheckedChange={onChange}
			/>
		</section>
	);
}

function PriceField({
	disabled,
	helpText,
	idPrefix,
	onChange,
	value
}: {
	disabled: boolean;
	helpText: string;
	idPrefix: string;
	onChange: (value: string) => void;
	value: string;
}) {
	return (
		<section className="grid gap-3">
			<Label htmlFor={`${idPrefix}-price`}>Custom invoice price</Label>
			<Input
				id={`${idPrefix}-price`}
				type="number"
				inputMode="decimal"
				min="0"
				step="0.01"
				value={value}
				disabled={disabled}
				placeholder="Use computed price"
				onChange={(event) => onChange(event.target.value)}
			/>
			<p className="text-muted-foreground text-sm">{helpText}</p>
		</section>
	);
}

function DepositOption({
	checked,
	disabled,
	idPrefix,
	onChange
}: {
	checked: boolean;
	disabled: boolean;
	idPrefix: string;
	onChange: (checked: boolean) => void;
}) {
	return (
		<section className="grid gap-3">
			<Label>Deposit</Label>
			<OptionCheckbox
				id={`${idPrefix}-include-deposit`}
				checked={checked}
				disabled={disabled}
				label="Include deposit paid"
				onCheckedChange={onChange}
			/>
		</section>
	);
}
