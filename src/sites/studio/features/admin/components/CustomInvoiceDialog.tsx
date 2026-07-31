import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { CreateCustomInvoiceResult } from "#convex/customInvoices";
import { Button } from "#/components/ui/button";
import { CustomInvoiceFormFields } from "#studio/features/admin/components/CustomInvoiceFormFields";
import { PreviousCustomInvoices } from "#studio/features/admin/components/PreviousCustomInvoices";
import type { PreviousCustomInvoiceItem } from "#studio/features/admin/components/PreviousCustomInvoices";
import {
	toAdminSessionAddons,
	toAdminSessionDuration
} from "#studio/features/admin/lib/admin-sessions";
import { SessionCustomerSummary } from "#studio/features/admin/components/SessionCustomerSummary";
import {
	type DownloadAdminBookingInvoiceResult,
	downloadAdminBookingInvoice
} from "#studio/features/admin/lib/download-admin-booking-invoice";
import { tryCatch, type UnexpectedError } from "#/lib/result";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import {
	buildCustomInvoiceGenerationData,
	formatCustomInvoiceAddonText,
	formatCustomInvoiceTotal,
	type CustomInvoiceDraft
} from "#studio/features/admin/lib/custom-invoices";
import {
	SERVICES,
	toDeliverableCountOption
} from "#studio/features/booking-form/lib/booking-form-model";
import type { BookingService } from "#studio/features/booking-invoice/lib/types";

type SessionRecord = Doc<"bookings">;
type CustomInvoiceRecord = Doc<"customInvoices">;

export type CustomInvoiceDialogProps = {
	open: boolean;
	session: SessionRecord;
	onOpenChange: (open: boolean) => void;
};

function isBookingService(value: string | undefined): value is BookingService {
	return SERVICES.some((service) => service === value);
}

function showCreateCustomInvoiceError(
	error: NonNullable<CreateCustomInvoiceResult[0]> | UnexpectedError
) {
	const messages: Record<typeof error.reason, string> = {
		NOT_AUTHENTICATED: "Please sign in first.",
		NOT_AUTHORIZED: "You do not have permission to create custom invoices.",
		BOOKING_NOT_FOUND: "This session no longer exists.",
		INVALID_CUSTOM_TOTAL_DUE_AMOUNT: "Enter a valid custom invoice price.",
		UNEXPECTED_ERROR: "Something went wrong with creating the custom invoice."
	};
	toast.error(messages[error.reason]);
}

function showInvoiceDownloadError(
	error: NonNullable<DownloadAdminBookingInvoiceResult[0]> | UnexpectedError
) {
	if (error.reason === "INVALID_INVOICE_INPUT") {
		toast.error(error.message);
		return;
	}

	toast.error("Unable to generate invoice.");
}

export function CustomInvoiceDialog({ open, session, onOpenChange }: CustomInvoiceDialogProps) {
	const createCustomInvoice = useMutation(api.customInvoices.createCustomInvoice);
	const customInvoicesResult = useQuery(api.customInvoices.listCustomInvoicesForBooking, {
		bookingId: session._id
	});
	const bookingSettings = useQuery(api.bookingSettings.get, {});
	const customInvoices: CustomInvoiceRecord[] | undefined = customInvoicesResult?.[1] ?? undefined;
	const [draft, setDraft] = useState<CustomInvoiceDraft>({
		service: "",
		duration: "",
		addons: [],
		essentialEditQuantity: toDeliverableCountOption(session.essentialEditQuantity),
		clipsPackageQuantity: toDeliverableCountOption(session.clipsPackageQuantity),
		dueDate: session.date,
		includeDepositLineItem: false,
		customTotalDueAmount: ""
	});
	const [isGenerating, setIsGenerating] = useState(false);
	const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
	const hasCompleteSessionSelection = Boolean(draft.service) && draft.duration !== "";
	const hasPartialSessionSelection = Boolean(draft.service) !== (draft.duration !== "");
	const hasInvoiceSelection =
		hasCompleteSessionSelection ||
		draft.addons.length > 0 ||
		draft.includeDepositLineItem ||
		draft.customTotalDueAmount.trim().length > 0;

	// Reset the draft each time the dialog opens for this session.
	useEffect(() => {
		if (open) {
			setDraft({
				service: "",
				duration: "",
				addons: [],
				essentialEditQuantity: toDeliverableCountOption(session.essentialEditQuantity),
				clipsPackageQuantity: toDeliverableCountOption(session.clipsPackageQuantity),
				dueDate: session.date,
				includeDepositLineItem: false,
				customTotalDueAmount: ""
			});
		}
	}, [
		session.clipsPackageQuantity,
		session.date,
		session.duration,
		session.essentialEditQuantity,
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
				session,
				addons: toAdminSessionAddons(input.addons),
				createdAt: input.createdAt,
				essentialEditQuantity: input.essentialEditQuantity ?? session.essentialEditQuantity,
				clipsPackageQuantity: input.clipsPackageQuantity ?? session.clipsPackageQuantity,
				dueDate: input.dueDate,
				duration: input.duration ? toAdminSessionDuration(input.duration) : undefined,
				includeDepositLineItem: input.includeDepositLineItem,
				invoiceNumber: input.invoiceNumber,
				leadTimeMinutes: bookingSettings.leadTimeMinutes,
				service: isBookingService(input.service) && input.duration ? input.service : null,
				customTotalDueAmount: input.customTotalDueAmount
			})
		);

		if (error !== null) {
			showInvoiceDownloadError(error);
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

		const generationData = buildCustomInvoiceGenerationData(session._id, draft);

		if (generationData.status === "invalidTotal") {
			toast.error("Enter a valid custom invoice price.");
			return;
		}

		setIsGenerating(true);

		const [error, customInvoice] = await tryCatch<CreateCustomInvoiceResult>(
			createCustomInvoice(generationData.createInput)
		);

		if (error !== null) {
			showCreateCustomInvoiceError(error);
			setIsGenerating(false);
			return;
		}

		const [downloadError] = await tryCatch<DownloadAdminBookingInvoiceResult>(
			downloadAdminBookingInvoice({
				session,
				...generationData.downloadInput,
				createdAt: customInvoice.createdAt,
				invoiceNumber: customInvoice.invoiceNumber,
				leadTimeMinutes: bookingSettings.leadTimeMinutes
			})
		);

		if (downloadError !== null) {
			showInvoiceDownloadError(downloadError);
			setIsGenerating(false);
			return;
		}

		onOpenChange(false);
		toast.success("Custom invoice download started.");
		setIsGenerating(false);
	}

	const previousInvoices: PreviousCustomInvoiceItem[] | undefined = customInvoices?.map(
		(invoice) => {
			const addonText = formatCustomInvoiceAddonText({
				addons: toAdminSessionAddons(invoice.addons),
				essentialEditQuantity: invoice.essentialEditQuantity ?? session.essentialEditQuantity,
				clipsPackageQuantity: invoice.clipsPackageQuantity ?? session.clipsPackageQuantity
			});

			return {
				id: invoice._id,
				invoiceNumber: invoice.invoiceNumber,
				description: `${invoice.service ?? "Add-ons only"}${addonText}`,
				total: formatCustomInvoiceTotal({
					service: invoice.service,
					addons: invoice.addons,
					duration: invoice.duration ?? "",
					includeDepositLineItem: invoice.includeDepositLineItem,
					essentialEditQuantity: invoice.essentialEditQuantity ?? session.essentialEditQuantity,
					clipsPackageQuantity: invoice.clipsPackageQuantity ?? session.clipsPackageQuantity,
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
					bookingName={session.name}
					bookingEmail={session.email}
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
							disabled={isGenerating || !hasInvoiceSelection || hasPartialSessionSelection}>
							{isGenerating ? <LoaderCircle className="size-4 animate-spin" /> : null}
							{isGenerating ? "Downloading..." : "Download"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
