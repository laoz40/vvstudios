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
import { CustomInvoiceFormFields } from "#studio/features/admin/components/CustomInvoiceFormFields";
import { PreviousCustomInvoices } from "#studio/features/admin/components/PreviousCustomInvoices";
import type { PreviousCustomInvoiceItem } from "#studio/features/admin/components/PreviousCustomInvoices";
import { SessionCustomerSummary } from "#studio/features/admin/components/SessionCustomerSummary";
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
import { DURATION_PRICES } from "#studio/features/booking-form/lib/booking-pricing";
import { BOOKING_DEPOSIT_AMOUNT } from "#studio/features/booking-invoice/lib/constants";
import { getAddonAmount } from "#studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import { parseRemainingBalanceAmountDraft } from "#studio/features/admin/lib/remaining-balance";
import type { BookingDuration, BookingService } from "#studio/features/booking-invoice/lib/types";
import { formatEditingAddonList } from "#studio/features/booking-form/lib/editing-addon-quantities";
import {
	toDeliverableCountOption,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";

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
	customTotalDueAmount: string;
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
	customTotalDueAmount?: number;
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

	const computedTotal = Math.max(serviceAmount + addonsAmount - depositAmount, 0);
	const totalDueAmount = input.customTotalDueAmount ?? computedTotal;

	return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
		totalDueAmount
	);
}

export function CustomInvoiceDialog({ open, booking, onOpenChange }: CustomInvoiceDialogProps) {
	const createCustomInvoice = useMutation(api.customInvoices.createCustomInvoice);
	const customInvoicesResult = useQuery(api.customInvoices.listCustomInvoicesForBooking, {
		bookingId: booking._id
	}) as ListCustomInvoicesForBookingResult | undefined;
	const bookingSettings = useQuery(api.bookingSettings.get, {});
	const customInvoices: CustomInvoiceRecord[] | undefined = customInvoicesResult?.[1] ?? undefined;
	const [draft, setDraft] = useState<CustomInvoiceDraft>({
		service: "",
		duration: booking.duration as BookingFormValues["duration"],
		addons: [],
		essentialEditQuantity: toDeliverableCountOption(booking.essentialEditQuantity),
		clipsPackageQuantity: toDeliverableCountOption(booking.clipsPackageQuantity),
		dueDate: booking.date,
		includeDepositLineItem: false,
		customTotalDueAmount: ""
	});
	const [isGenerating, setIsGenerating] = useState(false);
	const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
	const hasInvoiceSelection =
		Boolean(draft.service) ||
		draft.addons.length > 0 ||
		draft.includeDepositLineItem ||
		draft.customTotalDueAmount.trim().length > 0;

	// Reset the draft each time the dialog opens for this booking.
	useEffect(() => {
		if (open) {
			setDraft({
				service: "",
				duration: booking.duration as BookingFormValues["duration"],
				addons: [],
				essentialEditQuantity: toDeliverableCountOption(booking.essentialEditQuantity),
				clipsPackageQuantity: toDeliverableCountOption(booking.clipsPackageQuantity),
				dueDate: booking.date,
				includeDepositLineItem: false,
				customTotalDueAmount: ""
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
		customTotalDueAmount?: number;
	}) {
		if (!bookingSettings) {
			toast.error("Booking settings are still loading.");
			return;
		}
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
				leadTimeMinutes: bookingSettings.leadTimeMinutes,
				service: isBookingService(input.service) ? input.service : null,
				customTotalDueAmount: input.customTotalDueAmount
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

		if (!bookingSettings) {
			toast.error("Booking settings are still loading.");
			return;
		}

		const customTotalDueDraft = draft.customTotalDueAmount.trim();
		const customTotalDueAmountResult = customTotalDueDraft
			? parseRemainingBalanceAmountDraft(customTotalDueDraft)
			: null;

		if (customTotalDueAmountResult?.status === "invalid") {
			toast.error("Enter a valid custom invoice price.");
			return;
		}

		const customTotalDueAmount =
			customTotalDueAmountResult?.status === "valid"
				? customTotalDueAmountResult.amount
				: undefined;
		setIsGenerating(true);

		const [error, customInvoice] = await tryCatch<CreateCustomInvoiceResult>(
			createCustomInvoice({
				bookingId: booking._id,
				dueDate: draft.dueDate,
				...(draft.service ? { service: draft.service } : {}),
				duration: draft.duration,
				addons: draft.addons,
				...(draft.essentialEditQuantity
					? { essentialEditQuantity: draft.essentialEditQuantity }
					: {}),
				...(draft.clipsPackageQuantity ? { clipsPackageQuantity: draft.clipsPackageQuantity } : {}),
				includeDepositLineItem: draft.includeDepositLineItem,
				...(customTotalDueAmount !== undefined ? { customTotalDueAmount } : {})
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
				leadTimeMinutes: bookingSettings.leadTimeMinutes,
				service: draft.service || null,
				customTotalDueAmount
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

	const previousInvoices: PreviousCustomInvoiceItem[] | undefined = customInvoices?.map(
		(invoice) => {
			const addonText =
				invoice.addons.length > 0
					? ` · ${formatEditingAddonList(invoice.addons, {
							essentialEditQuantity: invoice.essentialEditQuantity ?? booking.essentialEditQuantity,
							clipsPackageQuantity: invoice.clipsPackageQuantity ?? booking.clipsPackageQuantity
						})}`
					: "";

			return {
				id: invoice._id,
				invoiceNumber: invoice.invoiceNumber,
				description: `${invoice.service ?? "Add-ons only"}${addonText}`,
				total: formatInvoiceTotal({
					service: invoice.service,
					addons: invoice.addons as BookingFormValues["addons"],
					duration: invoice.duration ?? booking.duration,
					includeDepositLineItem: invoice.includeDepositLineItem,
					essentialEditQuantity: invoice.essentialEditQuantity ?? booking.essentialEditQuantity,
					clipsPackageQuantity: invoice.clipsPackageQuantity ?? booking.clipsPackageQuantity,
					customTotalDueAmount: invoice.customTotalDueAmount
				})
			};
		}
	);

	function handleDownloadPreviousInvoice(invoiceId: string) {
		const invoice = customInvoices?.find((customInvoice) => customInvoice._id === invoiceId);

		if (!invoice) {
			return;
		}

		void downloadCustomInvoice(invoice);
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

				<SessionCustomerSummary
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
					<CustomInvoiceFormFields
						disabled={isGenerating}
						draft={draft}
						idPrefix="custom-invoice"
						onDraftChange={setDraft}
						priceHelpText="Leave blank to use the computed price from the selected service, add-ons, and deposit."
						deposit={{
							checked: draft.includeDepositLineItem,
							onChange: (includeDepositLineItem) =>
								setDraft((current) => ({ ...current, includeDepositLineItem }))
						}}
					/>

					<PreviousCustomInvoices
						downloadingInvoiceId={downloadingInvoiceId}
						invoices={previousInvoices}
						onDownload={handleDownloadPreviousInvoice}
					/>

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
