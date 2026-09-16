import { useState } from "react";
import { ChevronDown, RotateCcwClock } from "lucide-react";
import DownloadIcon from "#/components/ui/download-icon";
import MailFilledIcon from "#/components/ui/mail-filled-icon";
import { DropdownMenuItem } from "#/components/ui/dropdown-menu";
import { cn } from "#/lib/utils";
import { AnimatedDropdownMenuItem } from "#studio/features/admin/components/AnimatedDropdownMenuItem";
import type { Id } from "#convex/_generated/dataModel";

type LegacyInvoicesSubmenuProps = {
	downloadingLegacyCustomInvoiceId: Id<"customInvoices"> | null;
	downloadLabel: string;
	isDownloadingInvoice: boolean;
	isEmailingInvoice?: boolean;
	isDisabled?: boolean;
	onDownloadInvoice: () => void;
	onEmailInvoice?: () => void;
	onOpenCustomInvoices: () => void;
	showEmailInvoice?: boolean;
};

export function LegacyInvoicesSubmenu({
	downloadingLegacyCustomInvoiceId,
	downloadLabel,
	isDownloadingInvoice,
	isEmailingInvoice = false,
	isDisabled = false,
	onDownloadInvoice,
	onEmailInvoice,
	onOpenCustomInvoices,
	showEmailInvoice = false
}: LegacyInvoicesSubmenuProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<DropdownMenuItem
				disabled={isDisabled}
				onSelect={(event) => {
					event.preventDefault();
					setIsOpen((current) => !current);
				}}>
				<RotateCcwClock
					aria-hidden
					className="size-4 shrink-0 text-muted-foreground"
				/>
				Legacy invoices
				<ChevronDown
					aria-hidden
					className={cn(
						"ml-auto size-4 text-muted-foreground transition-transform",
						isOpen && "rotate-180"
					)}
				/>
			</DropdownMenuItem>
			{isOpen ? (
				<>
					<AnimatedDropdownMenuItem
						inset
						disabled={isDisabled || isDownloadingInvoice}
						onSelect={onDownloadInvoice}
						renderIcon={(iconRef) => (
							<DownloadIcon
								ref={iconRef}
								size={16}
								aria-hidden
								className="shrink-0 text-current"
							/>
						)}>
						{downloadLabel}
					</AnimatedDropdownMenuItem>
					{showEmailInvoice && onEmailInvoice ? (
						<AnimatedDropdownMenuItem
							inset
							disabled={isDisabled || isEmailingInvoice}
							onSelect={onEmailInvoice}
							renderIcon={(iconRef) => (
								<MailFilledIcon
									ref={iconRef}
									size={16}
									aria-hidden
									className="shrink-0 text-current"
								/>
							)}>
							Email invoice
						</AnimatedDropdownMenuItem>
					) : null}
					<AnimatedDropdownMenuItem
						inset
						disabled={isDisabled || downloadingLegacyCustomInvoiceId !== null}
						onSelect={onOpenCustomInvoices}
						renderIcon={(iconRef) => (
							<DownloadIcon
								ref={iconRef}
								size={16}
								aria-hidden
								className="shrink-0 text-current"
							/>
						)}>
						Custom invoices
					</AnimatedDropdownMenuItem>
				</>
			) : null}
		</>
	);
}
