import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import { Checkbox } from "#/components/ui/checkbox";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	ADDON_PRICES,
	BOOKING_DEPOSIT_AMOUNT,
	DURATION_PRICES,
} from "#studio/features/booking-invoice/lib/constants";
import type {
	BookingAddon,
	BookingDuration,
	BookingService,
} from "#studio/features/booking-invoice/lib/types";
import {
	ADDON_OPTIONS,
	SERVICES,
	bookingSchema,
	type BookingFormValues,
} from "#studio/features/booking-form/lib/form-shared";
import { toOptionId } from "#studio/lib/bookingdatetime";

type BookingRecord = Doc<"bookings">;

type CustomInvoiceDraft = {
	service: BookingService | "";
	addons: BookingFormValues["addons"];
	dueDate: string;
	includeDepositLineItem: boolean;
};

export type CustomInvoiceDialogProps = {
	open: boolean;
	booking: BookingRecord;
	onOpenChange: (open: boolean) => void;
};

function isBookingAddon(value: string): value is BookingAddon {
	return value in ADDON_PRICES;
}

function isBookingDuration(value: string): value is BookingDuration {
	return value in DURATION_PRICES;
}

function isBookingService(value: string | undefined): value is BookingService {
	return Boolean(value);
}

function formatInvoiceTotal(input: {
	service?: string;
	addons: string[];
	duration: string;
	includeDepositLineItem: boolean;
}) {
	const serviceAmount =
		isBookingService(input.service) && isBookingDuration(input.duration)
			? DURATION_PRICES[input.duration]
			: 0;
	const addonsAmount = input.addons.reduce(
		(total, addon) => total + (isBookingAddon(addon) ? ADDON_PRICES[addon] : 0),
		0,
	);
	const depositAmount = input.includeDepositLineItem ? BOOKING_DEPOSIT_AMOUNT : 0;

	return new Intl.NumberFormat("en-AU", {
		style: "currency",
		currency: "AUD",
	}).format(Math.max(serviceAmount + addonsAmount - depositAmount, 0));
}

export function CustomInvoiceDialog({ open, booking, onOpenChange }: CustomInvoiceDialogProps) {
	const createCustomInvoice = useMutation(api.customInvoices.createCustomInvoice);
	const customInvoices = useQuery(api.customInvoices.listCustomInvoicesForBooking, {
		bookingId: booking._id,
	});
	const [draft, setDraft] = useState<CustomInvoiceDraft>({
		service: "",
		addons: [],
		dueDate: booking.date,
		includeDepositLineItem: false,
	});
	const [isGenerating, setIsGenerating] = useState(false);
	const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
	const hasInvoiceSelection =
		Boolean(draft.service) || draft.addons.length > 0 || draft.includeDepositLineItem;

	useEffect(() => {
		if (open) {
			setDraft({ service: "", addons: [], dueDate: booking.date, includeDepositLineItem: false });
		}
	}, [booking.date, open]);

	async function downloadCustomInvoice(input: {
		_id: string;
		invoiceNumber: string;
		service?: string;
		addons: string[];
		dueDate?: string;
		includeDepositLineItem: boolean;
		createdAt: number;
	}) {
		setDownloadingInvoiceId(input._id);

		try {
			const { downloadBookingInvoicePdf } =
				await import("#studio/features/booking-invoice/pdf/download-booking-invoice-pdf");
			const parsedBooking = bookingSchema.safeParse({
				name: booking.name,
				phone: booking.phone,
				accountName: booking.accountName,
				abn: booking.abn,
				email: booking.email,
				date: booking.date,
				time: booking.time,
				duration: booking.duration,
				service: booking.service,
				addons: input.addons,
				notes: booking.notes ?? "",
			});

			if (!parsedBooking.success) {
				toast.error(parsedBooking.error.issues[0]?.message ?? "Unable to generate invoice.");
				return;
			}

			await downloadBookingInvoicePdf({
				bookingId: booking._id,
				name: parsedBooking.data.name,
				phone: parsedBooking.data.phone,
				accountName: parsedBooking.data.accountName,
				abn: parsedBooking.data.abn,
				email: parsedBooking.data.email,
				date: parsedBooking.data.date,
				dueDate: input.dueDate ?? parsedBooking.data.date,
				time: parsedBooking.data.time,
				duration: parsedBooking.data.duration,
				service: isBookingService(input.service) ? input.service : undefined,
				addons: parsedBooking.data.addons,
				createdAt: input.createdAt,
				includeDepositLineItem: input.includeDepositLineItem,
				invoiceNumber: input.invoiceNumber,
			});
			toast.success("Custom invoice download started.");
		} catch {
			toast.error("Unable to generate invoice.");
		} finally {
			setDownloadingInvoiceId(null);
		}
	}

	async function handleGenerateCustomInvoice() {
		if (!hasInvoiceSelection) {
			return;
		}

		setIsGenerating(true);

		try {
			const { downloadBookingInvoicePdf } =
				await import("#studio/features/booking-invoice/pdf/download-booking-invoice-pdf");
			const customInvoice = await createCustomInvoice({
				bookingId: booking._id,
				dueDate: draft.dueDate,
				service: draft.service || undefined,
				addons: draft.addons,
				includeDepositLineItem: draft.includeDepositLineItem,
			});

			const parsedBooking = bookingSchema.safeParse({
				name: booking.name,
				phone: booking.phone,
				accountName: booking.accountName,
				abn: booking.abn,
				email: booking.email,
				date: booking.date,
				time: booking.time,
				duration: booking.duration,
				service: booking.service,
				addons: draft.addons,
				notes: booking.notes ?? "",
			});

			if (!parsedBooking.success) {
				toast.error(parsedBooking.error.issues[0]?.message ?? "Unable to generate invoice.");
				return;
			}

			await downloadBookingInvoicePdf({
				bookingId: booking._id,
				name: parsedBooking.data.name,
				phone: parsedBooking.data.phone,
				accountName: parsedBooking.data.accountName,
				abn: parsedBooking.data.abn,
				email: parsedBooking.data.email,
				date: parsedBooking.data.date,
				dueDate: draft.dueDate,
				time: parsedBooking.data.time,
				duration: parsedBooking.data.duration,
				service: draft.service || undefined,
				addons: parsedBooking.data.addons,
				createdAt: customInvoice.createdAt,
				includeDepositLineItem: draft.includeDepositLineItem,
				invoiceNumber: customInvoice.invoiceNumber,
			});
			onOpenChange(false);
			toast.success("Custom invoice download started.");
		} catch {
			toast.error("Unable to generate invoice.");
		} finally {
			setIsGenerating(false);
		}
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

				<div className="rounded-lg border bg-muted/40 p-4">
					<dl className="grid gap-3 text-sm sm:grid-cols-2">
						<div className="grid gap-1">
							<dt className="text-muted-foreground">Customer</dt>
							<dd className="font-medium">{booking.name}</dd>
						</div>
						<div className="grid gap-1">
							<dt className="text-muted-foreground">Email</dt>
							<dd className="break-all font-medium">{booking.email}</dd>
						</div>
					</dl>
				</div>

				<form
					className="grid gap-6"
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
											className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
											<div className="grid gap-1">
												<span className="font-medium">{invoice.invoiceNumber}</span>
												<span className="text-muted-foreground">
													{invoice.service ?? "Add-ons only"}
													{invoice.addons.length > 0 ? ` · ${invoice.addons.join(", ")}` : ""}
													{" · "}
													{formatInvoiceTotal({
														service: invoice.service,
														addons: invoice.addons,
														duration: booking.duration,
														includeDepositLineItem: invoice.includeDepositLineItem,
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
						<Label>Service</Label>
						<div className="grid gap-3 sm:grid-cols-2">
							{SERVICES.map((service) => {
								const optionId = `custom-invoice-service-${toOptionId(service)}`;
								const isChecked = draft.service === service;

								return (
									<label
										key={service}
										htmlFor={optionId}
										className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors has-checked:border-primary has-checked:bg-primary/5">
										<Checkbox
											id={optionId}
											checked={isChecked}
											disabled={isGenerating}
											onCheckedChange={(checked) => {
												setDraft((current) => ({
													...current,
													service: checked === true ? service : "",
												}));
											}}
										/>
										<span className="font-medium">{service}</span>
									</label>
								);
							})}
						</div>
					</section>

					<section className="grid gap-3">
						<Label>Add-ons</Label>
						<div className="grid gap-3">
							{ADDON_OPTIONS.map((addon) => {
								const optionId = `custom-invoice-addon-${toOptionId(addon)}`;
								const isChecked = draft.addons.includes(addon);

								return (
									<label
										key={addon}
										htmlFor={optionId}
										className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors has-checked:border-primary has-checked:bg-primary/5">
										<Checkbox
											id={optionId}
											checked={isChecked}
											disabled={isGenerating}
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

					<section className="grid gap-3">
						<Label>Deposit</Label>
						<label
							htmlFor="custom-invoice-include-deposit"
							className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors has-checked:border-primary has-checked:bg-primary/5">
							<Checkbox
								id="custom-invoice-include-deposit"
								checked={draft.includeDepositLineItem}
								disabled={isGenerating}
								onCheckedChange={(checked) => {
									setDraft((current) => ({
										...current,
										includeDepositLineItem: checked === true,
									}));
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
