import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { tryCatch, type UnexpectedError } from "#/lib/result";
import { CustomInvoiceFormFields } from "#studio/features/admin/components/CustomInvoiceFormFields";
import { PreviousCustomInvoices } from "#studio/features/admin/components/PreviousCustomInvoices";
import type { PreviousCustomInvoiceItem } from "#studio/features/admin/components/PreviousCustomInvoices";
import { SessionCustomerSummary } from "#studio/features/admin/components/SessionCustomerSummary";
import {
	toAdminSessionAddons,
	toAdminSessionDuration
} from "#studio/features/admin/lib/admin-sessions";
import type { AdminPackageRow } from "#studio/features/admin/lib/admin-packages";
import {
	formatCustomInvoiceAddonText,
	formatCustomInvoiceCurrency,
	parseCustomInvoiceTotalDraft
} from "#studio/features/admin/lib/custom-invoices";
import { formatDateValue } from "#studio/lib/bookingdatetime";
import {
	calculatePackageAmounts,
	type MultiBookingSize
} from "#studio/features/booking-form/lib/booking-pricing";
import {
	toDeliverableCountOption,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";
import { downloadBlob } from "#studio/features/booking-invoice/pdf/download-blob";

type PackageCustomInvoiceRecord = Doc<"customInvoices">;
type CreatePackageCustomInvoiceResult = FunctionReturnType<
	typeof api.customInvoices.createPackageCustomInvoice
>;
type CreatePackageCustomInvoiceError =
	| Exclude<CreatePackageCustomInvoiceResult[0], null>
	| UnexpectedError;

type PackageCustomInvoiceDraft = {
	duration: BookingFormValues["duration"] | "";
	addons: BookingFormValues["addons"];
	essentialEditQuantity: BookingFormValues["essentialEditQuantity"];
	clipsPackageQuantity: BookingFormValues["clipsPackageQuantity"];
	packageSize: MultiBookingSize;
	includePackageDiscount: boolean;
	dueDate: string;
	customTotalDueAmount: string;
};

type PackageCustomInvoiceDialogProps = {
	open: boolean;
	packageRow: AdminPackageRow;
	onOpenChange: (open: boolean) => void;
};

function showCreatePackageCustomInvoiceError(error: CreatePackageCustomInvoiceError) {
	switch (error.reason) {
		case "NOT_AUTHENTICATED":
			toast.error("Please sign in first.");
			break;
		case "NOT_AUTHORIZED":
			toast.error("You do not have permission to create custom invoices.");
			break;
		case "PACKAGE_NOT_FOUND":
			toast.error("This package no longer exists.");
			break;
		case "INVALID_CUSTOM_TOTAL_DUE_AMOUNT":
			toast.error("Enter a valid custom invoice price.");
			break;
		case "UNEXPECTED_ERROR":
			toast.error("Something went wrong with creating the custom invoice.");
			break;
		default: {
			const _exhaustive: never = error;
			void _exhaustive;
		}
	}
}

function formatPackageInvoiceTotal(input: {
	addons: BookingFormValues["addons"];
	clipsPackageQuantity?: BookingFormValues["clipsPackageQuantity"];
	customTotalDueAmount?: number;
	duration: BookingFormValues["duration"] | "";
	essentialEditQuantity?: BookingFormValues["essentialEditQuantity"];
	packageSize: MultiBookingSize;
	includePackageDiscount: boolean;
}) {
	const totalDueAmount =
		input.customTotalDueAmount ??
		calculatePackageAmounts({ ...input, includeDiscount: input.includePackageDiscount })
			.totalDueAmount;

	return formatCustomInvoiceCurrency(totalDueAmount);
}

function toDateInputValue(timestamp: number) {
	return formatDateValue(new Date(timestamp));
}

export function PackageCustomInvoiceDialog({
	open,
	packageRow,
	onOpenChange
}: PackageCustomInvoiceDialogProps) {
	const createPackageCustomInvoice = useMutation(api.customInvoices.createPackageCustomInvoice);
	const getCustomPackageInvoicePdf = useAction(
		api.invoices.getAdminCustomMultiBookingInvoicePdfById
	);
	const customInvoicesResult = useQuery(api.customInvoices.listCustomInvoicesForPackage, {
		multiBookingId: packageRow.id
	});
	const customInvoices: PackageCustomInvoiceRecord[] | undefined =
		customInvoicesResult?.[1] ?? undefined;
	const defaultDueDate = toDateInputValue(packageRow.invoiceDueAt);
	const [draft, setDraft] = useState<PackageCustomInvoiceDraft>({
		duration: "",
		addons: [],
		essentialEditQuantity: toDeliverableCountOption(packageRow.essentialEditQuantity),
		clipsPackageQuantity: toDeliverableCountOption(packageRow.clipsPackageQuantity),
		packageSize: packageRow.packageSize,
		includePackageDiscount: true,
		dueDate: defaultDueDate,
		customTotalDueAmount: ""
	});
	const [isGenerating, setIsGenerating] = useState(false);
	const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);
	const hasInvoiceSelection =
		draft.duration !== "" ||
		draft.addons.length > 0 ||
		draft.packageSize !== packageRow.packageSize ||
		!draft.includePackageDiscount ||
		draft.dueDate !== defaultDueDate ||
		draft.customTotalDueAmount.trim().length > 0;

	// Reset the draft each time the dialog opens for this package.
	useEffect(() => {
		if (!open) {
			return;
		}

		setDraft({
			duration: "",
			addons: [],
			essentialEditQuantity: toDeliverableCountOption(packageRow.essentialEditQuantity),
			clipsPackageQuantity: toDeliverableCountOption(packageRow.clipsPackageQuantity),
			packageSize: packageRow.packageSize,
			includePackageDiscount: true,
			dueDate: defaultDueDate,
			customTotalDueAmount: ""
		});
	}, [
		open,
		packageRow.clipsPackageQuantity,
		packageRow.duration,
		packageRow.essentialEditQuantity,
		packageRow.invoiceDueAt,
		defaultDueDate,
		packageRow.packageSize
	]);

	async function downloadCustomPackageInvoice(customInvoiceId: Doc<"customInvoices">["_id"]) {
		setDownloadingInvoiceId(customInvoiceId);
		const [error, invoice] = await tryCatch(getCustomPackageInvoicePdf({ customInvoiceId }));

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have permission to download custom package invoices.");
					break;
				case "PACKAGE_NOT_FOUND":
					toast.error("This package or custom invoice no longer exists.");
					break;
				case "INVALID_BOOKING_DATA":
				case "INVOICE_DOWNLOAD_FAILED":
				case "INVOICE_EMAIL_RENDER_FAILED":
				case "UNEXPECTED_ERROR":
					toast.error("Unable to generate custom package invoice.");
					break;
				default: {
					const _exhaustive: never = error;
					void _exhaustive;
					break;
				}
			}

			setDownloadingInvoiceId(null);
			return;
		}

		downloadBlob(new Blob([invoice.content], { type: invoice.contentType }), invoice.filename);
		toast.success("Custom invoice download started.");
		setDownloadingInvoiceId(null);
	}

	async function handleGenerateCustomInvoice() {
		if (!hasInvoiceSelection) {
			return;
		}

		const customTotalDueAmountResult = parseCustomInvoiceTotalDraft(draft.customTotalDueAmount);

		if (customTotalDueAmountResult.status === "invalid") {
			toast.error("Enter a valid custom invoice price.");
			return;
		}

		const customTotalDueAmount =
			customTotalDueAmountResult.status === "valid" ? customTotalDueAmountResult.amount : undefined;
		setIsGenerating(true);

		const [error, customInvoice] = await tryCatch(
			createPackageCustomInvoice({
				multiBookingId: packageRow.id,
				dueDate: draft.dueDate,
				...(draft.duration ? { duration: draft.duration } : {}),
				addons: draft.addons,
				...(draft.essentialEditQuantity
					? { essentialEditQuantity: draft.essentialEditQuantity }
					: {}),
				...(draft.clipsPackageQuantity ? { clipsPackageQuantity: draft.clipsPackageQuantity } : {}),
				packageSize: draft.packageSize,
				includePackageDiscount: draft.includePackageDiscount,
				includeDepositLineItem: false,
				...(customTotalDueAmount !== undefined ? { customTotalDueAmount } : {})
			})
		);

		if (error !== null) {
			showCreatePackageCustomInvoiceError(error);
			setIsGenerating(false);
			return;
		}

		await downloadCustomPackageInvoice(customInvoice.customInvoiceId);
		onOpenChange(false);
		setIsGenerating(false);
	}

	const previousInvoices: PreviousCustomInvoiceItem[] | undefined = customInvoices?.map(
		(invoice) => {
			const addonText = formatCustomInvoiceAddonText({
				addons: toAdminSessionAddons(invoice.addons),
				essentialEditQuantity: toDeliverableCountOption(
					invoice.essentialEditQuantity ?? packageRow.essentialEditQuantity
				),
				clipsPackageQuantity: toDeliverableCountOption(
					invoice.clipsPackageQuantity ?? packageRow.clipsPackageQuantity
				)
			});
			const packageSize = invoice.packageSize ?? packageRow.packageSize;
			const duration = invoice.duration ?? "Add-ons only";

			return {
				id: invoice._id,
				invoiceNumber: invoice.invoiceNumber,
				description: `${packageSize} sessions · ${duration}${addonText}`,
				total: formatPackageInvoiceTotal({
					addons: toAdminSessionAddons(invoice.addons),
					clipsPackageQuantity: toDeliverableCountOption(
						invoice.clipsPackageQuantity ?? packageRow.clipsPackageQuantity
					),
					customTotalDueAmount: invoice.customTotalDueAmount,
					duration: toAdminSessionDuration(invoice.duration),
					essentialEditQuantity: toDeliverableCountOption(
						invoice.essentialEditQuantity ?? packageRow.essentialEditQuantity
					),
					includePackageDiscount: invoice.includePackageDiscount !== false,
					packageSize
				})
			};
		}
	);

	function handleDownloadPreviousInvoice(invoiceId: string) {
		const invoice = customInvoices?.find((customInvoice) => customInvoice._id === invoiceId);

		if (!invoice) {
			return;
		}

		void downloadCustomPackageInvoice(invoice._id);
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
					bookingName={packageRow.customerName}
					bookingEmail={packageRow.customerEmail}
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
						idPrefix="package-custom-invoice"
						onDraftChange={setDraft}
						priceHelpText="Leave blank to use the computed price from the selected duration, add-ons, and package size."
						showService={false}
						packageSize={{
							value: draft.packageSize,
							onChange: (packageSize) => setDraft((current) => ({ ...current, packageSize }))
						}}
						packageDiscount={{
							checked: draft.includePackageDiscount,
							onChange: (includePackageDiscount) =>
								setDraft((current) => ({ ...current, includePackageDiscount }))
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
