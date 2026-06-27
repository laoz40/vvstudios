import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type {
	CreateCustomInvoiceResult,
	ListCustomInvoicesForBookingResult
} from "#convex/customInvoices";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import { AdminAddonOptions } from "#studio/features/admin/components/AdminAddonOptions";
import { BookingCustomerSummary } from "#studio/features/admin/components/BookingCustomerSummary";
import {
	type DownloadAdminBookingInvoiceResult,
	downloadAdminBookingInvoice
} from "#studio/features/admin/lib/download-admin-booking-invoice";
import { tryCatch } from "#/lib/result";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { cn } from "#/lib/utils";
import { DURATION_PRICES } from "#studio/features/booking-form/lib/booking-pricing";
import { BOOKING_DEPOSIT_AMOUNT } from "#studio/features/booking-invoice/lib/constants";
import { getAddonAmount } from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import type { BookingDuration, BookingService } from "#studio/features/booking-invoice/lib/types";
import { formatEditingAddonLabel } from "#studio/features/booking-form/lib/editing-addon-quantities";
import {
	DELIVERABLE_COUNT_OPTIONS,
	DURATION_OPTIONS,
	SERVICES,
	toDeliverableCountOption,
	type BookingFormValues
} from "#studio/features/booking-form/lib/form-shared";
import { toOptionId } from "#studio/lib/bookingdatetime";

type BookingRecord = Doc<"bookings">;
type CustomInvoiceRecord = Doc<"customInvoices">;

type CustomInvoiceDraft = {
	service: BookingService | "";
	duration: BookingFormValues["duration"];
	addons: BookingFormValues["addons"];
	essentialEditQuantity: BookingFormValues["essentialEditQuantity"];
	clipsPackageQuantity: BookingFormValues["clipsPackageQuantity"];
	dueDate: string;
	includeDepositLineItem: boolean;
};

export type CustomInvoiceDialogProps = {
	open: boolean;
	booking: BookingRecord;
	onOpenChange: (open: boolean) => void;
};

function isBookingDuration(value: string): value is BookingDuration {
	return value in DURATION_PRICES;
}

function isBookingService(value: string | undefined): value is BookingService {
	return Boolean(value);
}

function formatInvoiceTotal(input: {
	service?: string;
	addons: BookingFormValues["addons"];
	duration: string;
	includeDepositLineItem: boolean;
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
}) {
	const serviceAmount =
		isBookingService(input.service) && isBookingDuration(input.duration)
			? DURATION_PRICES[input.duration]
			: 0;
	const addonsAmount = input.addons.reduce(
		(total, addon) => total + getAddonAmount(addon, input),
		0
	);
	const depositAmount = input.includeDepositLineItem ? BOOKING_DEPOSIT_AMOUNT : 0;

	return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
		Math.max(serviceAmount + addonsAmount - depositAmount, 0)
	);
}

type CustomInvoiceQuantityOptionsProps = {
	disabled: boolean;
	idPrefix: string;
	label: string;
	onChange: (value: BookingFormValues["essentialEditQuantity"]) => void;
	value: string;
};

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
				{DELIVERABLE_COUNT_OPTIONS.map((count) => {
					const optionId = `${idPrefix}-${count}`;
					const isChecked = value === count;

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
							<Checkbox
								id={optionId}
								checked={isChecked}
								disabled={disabled}
								onCheckedChange={(checked) => {
									if (checked === true) {
										onChange(count);
									}
								}}
							/>
							<span className="font-medium">{count}</span>
						</label>
					);
				})}
			</div>
		</section>
	);
}

export function CustomInvoiceDialog({ open, booking, onOpenChange }: CustomInvoiceDialogProps) {
	const createCustomInvoice = useMutation(api.customInvoices.createCustomInvoice);
	const customInvoicesResult = useQuery(api.customInvoices.listCustomInvoicesForBooking, {
		bookingId: booking._id
	}) as ListCustomInvoicesForBookingResult | undefined;
	const customInvoices: CustomInvoiceRecord[] | undefined = customInvoicesResult?.[1] ?? undefined;
	const [draft, setDraft] = useState<CustomInvoiceDraft>({
		service: "",
		duration: booking.duration as BookingFormValues["duration"],
		addons: [],
		essentialEditQuantity: toDeliverableCountOption(booking.essentialEditQuantity),
		clipsPackageQuantity: toDeliverableCountOption(booking.clipsPackageQuantity),
		dueDate: booking.date,
		includeDepositLineItem: false
	});
	const [isGenerating, setIsGenerating] = useState(false);
	const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
	const hasInvoiceSelection =
		Boolean(draft.service) || draft.addons.length > 0 || draft.includeDepositLineItem;

	useEffect(() => {
		if (open) {
			setDraft({
				service: "",
				duration: booking.duration as BookingFormValues["duration"],
				addons: [],
				essentialEditQuantity: toDeliverableCountOption(booking.essentialEditQuantity),
				clipsPackageQuantity: toDeliverableCountOption(booking.clipsPackageQuantity),
				dueDate: booking.date,
				includeDepositLineItem: false
			});
		}
	}, [
		booking.clipsPackageQuantity,
		booking.date,
		booking.duration,
		booking.essentialEditQuantity,
		open
	]);

	async function downloadCustomInvoice(input: {
		_id: string;
		invoiceNumber: string;
		service?: string;
		addons: string[];
		dueDate?: string;
		includeDepositLineItem: boolean;
		createdAt: number;
		duration?: string;
		essentialEditQuantity?: string;
		clipsPackageQuantity?: string;
	}) {
		setDownloadingInvoiceId(input._id);

		const [error] = await tryCatch<DownloadAdminBookingInvoiceResult>(
			downloadAdminBookingInvoice({
				booking,
				addons: input.addons as BookingFormValues["addons"],
				createdAt: input.createdAt,
				essentialEditQuantity: input.essentialEditQuantity ?? booking.essentialEditQuantity,
				clipsPackageQuantity: input.clipsPackageQuantity ?? booking.clipsPackageQuantity,
				dueDate: input.dueDate,
				duration: input.duration as BookingFormValues["duration"] | undefined,
				includeDepositLineItem: input.includeDepositLineItem,
				invoiceNumber: input.invoiceNumber,
				service: isBookingService(input.service) ? input.service : undefined
			})
		);

		if (error !== null) {
			switch (error.reason) {
				case "INVALID_INVOICE_INPUT":
					toast.error(error.message);
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Unable to generate invoice.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setDownloadingInvoiceId(null);
			return;
		}

		toast.success("Custom invoice download started.");
		setDownloadingInvoiceId(null);
	}

	async function handleGenerateCustomInvoice() {
		if (!hasInvoiceSelection) {
			return;
		}

		setIsGenerating(true);

		const [error, customInvoice] = await tryCatch<CreateCustomInvoiceResult>(
			createCustomInvoice({
				bookingId: booking._id,
				dueDate: draft.dueDate,
				service: draft.service || undefined,
				duration: draft.duration,
				addons: draft.addons,
				essentialEditQuantity: draft.essentialEditQuantity || undefined,
				clipsPackageQuantity: draft.clipsPackageQuantity || undefined,
				includeDepositLineItem: draft.includeDepositLineItem
			})
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("Please sign in first.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have permission to create custom invoices.");
					break;

				case "BOOKING_NOT_FOUND":
					toast.error("This booking no longer exists.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong with creating the custom invoice.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsGenerating(false);
			return;
		}

		const [downloadError] = await tryCatch<DownloadAdminBookingInvoiceResult>(
			downloadAdminBookingInvoice({
				booking,
				addons: draft.addons,
				createdAt: customInvoice.createdAt,
				essentialEditQuantity: draft.essentialEditQuantity,
				clipsPackageQuantity: draft.clipsPackageQuantity,
				dueDate: draft.dueDate,
				duration: draft.duration,
				includeDepositLineItem: draft.includeDepositLineItem,
				invoiceNumber: customInvoice.invoiceNumber,
				service: draft.service || undefined
			})
		);

		if (downloadError !== null) {
			switch (downloadError.reason) {
				case "INVALID_INVOICE_INPUT":
					toast.error(downloadError.message);
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Unable to generate invoice.");
					break;

				default: {
					const _exhaustive: never = downloadError;
					return _exhaustive;
				}
			}

			setIsGenerating(false);
			return;
		}

		onOpenChange(false);
		toast.success("Custom invoice download started.");
		setIsGenerating(false);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (isGenerating && !nextOpen) {
					return;
				}

				onOpenChange(nextOpen);
			}}>
			<DialogContent
				className="overflow-y-auto sm:max-w-4xl"
				data-lenis-prevent
				onInteractOutside={(event) => {
					if (isGenerating) {
						event.preventDefault();
					}
				}}
				onEscapeKeyDown={(event) => {
					if (isGenerating) {
						event.preventDefault();
					}
				}}>
				<DialogClose asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute top-2 right-2"
						aria-label="Close custom invoice dialog"
						disabled={isGenerating}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="text-left">
					<DialogTitle>Create custom invoice</DialogTitle>
				</DialogHeader>

				<BookingCustomerSummary
					bookingName={booking.name}
					bookingEmail={booking.email}
				/>

				<form
					className="grid gap-6"
					data-lenis-prevent
					onSubmit={(event) => {
						event.preventDefault();
						void handleGenerateCustomInvoice();
					}}>
					<section className="grid gap-3">
						<Label htmlFor="custom-invoice-due-date">Due date</Label>
						<Input
							id="custom-invoice-due-date"
							type="date"
							value={draft.dueDate}
							disabled={isGenerating}
							required
							onChange={(event) => {
								setDraft((current) => ({ ...current, dueDate: event.target.value }));
							}}
						/>
					</section>
					{customInvoices && customInvoices.length > 0 ? (
						<section className="grid gap-3">
							<Label>Previous custom invoices</Label>
							<div className="rounded-lg border bg-muted/40 p-3 text-sm">
								<ul className="grid gap-3">
									{customInvoices.map((invoice) => (
										<li
											key={invoice._id}
											className={cn(
												"flex flex-col gap-2",
												"sm:flex-row sm:items-center sm:justify-between"
											)}>
											<div className="grid gap-1">
												<span className="font-medium">{invoice.invoiceNumber}</span>
												<span className="text-muted-foreground">
													{invoice.service ?? "Add-ons only"}
													{invoice.addons.length > 0
														? ` · ${invoice.addons
																.map((addon) =>
																	formatEditingAddonLabel(addon, {
																		essentialEditQuantity:
																			invoice.essentialEditQuantity ??
																			booking.essentialEditQuantity,
																		clipsPackageQuantity:
																			invoice.clipsPackageQuantity ?? booking.clipsPackageQuantity
																	})
																)
																.join(", ")}`
														: ""}
													{" · "}
													{formatInvoiceTotal({
														service: invoice.service,
														addons: invoice.addons as BookingFormValues["addons"],
														duration: invoice.duration ?? booking.duration,
														includeDepositLineItem: invoice.includeDepositLineItem,
														essentialEditQuantity:
															invoice.essentialEditQuantity ?? booking.essentialEditQuantity,
														clipsPackageQuantity:
															invoice.clipsPackageQuantity ?? booking.clipsPackageQuantity
													})}
												</span>
											</div>
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={downloadingInvoiceId === invoice._id}
												onClick={() => void downloadCustomInvoice(invoice)}>
												{downloadingInvoiceId === invoice._id ? "Downloading..." : "Download"}
											</Button>
										</li>
									))}
								</ul>
							</div>
						</section>
					) : null}

					<section className="grid gap-3">
						<Label>Session duration</Label>
						<div className="grid gap-3 sm:grid-cols-3">
							{DURATION_OPTIONS.map((duration) => {
								const optionId = `custom-invoice-duration-${toOptionId(duration)}`;
								const isChecked = draft.duration === duration;

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
										<Checkbox
											id={optionId}
											checked={isChecked}
											disabled={isGenerating}
											onCheckedChange={(checked) => {
												if (checked !== true) {
													return;
												}

												setDraft((current) => ({ ...current, duration }));
											}}
										/>
										<span className="font-medium">{duration}</span>
									</label>
								);
							})}
						</div>
					</section>

					<section className="grid gap-3">
						<Label>Service</Label>
						<div className="grid gap-3 sm:grid-cols-2">
							{SERVICES.map((service) => {
								const optionId = `custom-invoice-service-${toOptionId(service)}`;
								const isChecked = draft.service === service;

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
										<Checkbox
											id={optionId}
											checked={isChecked}
											disabled={isGenerating}
											onCheckedChange={(checked) => {
												setDraft((current) => ({
													...current,
													service: checked === true ? service : ""
												}));
											}}
										/>
										<span className="font-medium">{service}</span>
									</label>
								);
							})}
						</div>
					</section>

					<AdminAddonOptions
						addons={draft.addons}
						essentialEditQuantity={draft.essentialEditQuantity}
						clipsPackageQuantity={draft.clipsPackageQuantity}
						disabled={isGenerating}
						idPrefix="custom-invoice-addon"
						onChange={(nextValues) => {
							setDraft((current) => ({ ...current, ...nextValues }));
						}}
					/>

					{draft.addons.includes("Essential Edit") ? (
						<CustomInvoiceQuantityOptions
							idPrefix="custom-invoice-essential-edit-quantity"
							label="Essential Edit quantity"
							value={draft.essentialEditQuantity ?? ""}
							disabled={isGenerating}
							onChange={(count) => {
								setDraft((current) => ({ ...current, essentialEditQuantity: count }));
							}}
						/>
					) : null}
					{draft.addons.includes("Clips Package") ? (
						<CustomInvoiceQuantityOptions
							idPrefix="custom-invoice-clips-package-quantity"
							label="Clips Package quantity"
							value={draft.clipsPackageQuantity ?? ""}
							disabled={isGenerating}
							onChange={(count) => {
								setDraft((current) => ({ ...current, clipsPackageQuantity: count }));
							}}
						/>
					) : null}

					<section className="grid gap-3">
						<Label>Deposit</Label>
						<label
							htmlFor="custom-invoice-include-deposit"
							className={cn(
								"flex cursor-pointer items-center gap-3",
								"p-3",
								"rounded-lg border",
								"transition-colors",
								"has-checked:border-primary has-checked:bg-primary/5"
							)}>
							<Checkbox
								id="custom-invoice-include-deposit"
								checked={draft.includeDepositLineItem}
								disabled={isGenerating}
								onCheckedChange={(checked) => {
									setDraft((current) => ({ ...current, includeDepositLineItem: checked === true }));
								}}
							/>
							<span className="font-medium">Include deposit paid</span>
						</label>
					</section>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isGenerating}>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={isGenerating || !hasInvoiceSelection}>
							{isGenerating ? <LoaderCircle className="size-4 animate-spin" /> : null}
							{isGenerating ? "Downloading..." : "Download"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
