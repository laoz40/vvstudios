import { useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import ClockIcon from "#/components/ui/clock-icon";
import DownloadIcon from "#/components/ui/download-icon";
import DotsHorizontalIcon from "#/components/ui/dots-horizontal-icon";
import BrandGoogleIcon from "#/components/ui/brand-google-icon";
import BrandStripeIcon from "#/components/ui/brand-stripe-icon";
import HashtagIcon from "#/components/ui/hashtag-icon";
import MailFilledIcon from "#/components/ui/mail-filled-icon";
import PenIcon from "#/components/ui/pen-icon";
import PhoneVolume from "#/components/ui/phone-volume";
import Stack3Icon from "#/components/ui/stack-3-icon";
import TrashIcon from "#/components/ui/trash-icon";
import type { AnimatedIconHandle } from "#/components/ui/types";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { cn } from "#/lib/utils";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger
} from "#/components/ui/dropdown-menu";
import { AnimatedDropdownMenuItem } from "#studio/features/admin/components/AnimatedDropdownMenuItem";
import { copyText } from "#studio/features/admin/components/AdminDashboardTableUtils";
import { LegacyInvoicesSubmenu } from "#studio/features/admin/components/LegacyInvoicesSubmenu";
import { StripeIdCopyMenuItems } from "#studio/features/admin/components/StripeIdCopyMenuItems";
import { SessionEditorAssignment } from "#studio/features/admin/components/SessionEditorAssignment";
import {
	EDIT_STATUS_OPTIONS,
	deliverableStatusIconMap,
	deliverableStatusLabelMap,
	deliverableStatusTabClassNameMap,
	deliverableStatusTabLabelMap
} from "#studio/features/admin/lib/session-edit-status";
import type { SessionActionDetails } from "#studio/features/admin/lib/admin-sessions";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import type { useDeleteAction } from "#studio/features/admin/hooks/useDeleteAction";
import type { useDeliverablesEmailAction } from "#studio/features/admin/hooks/useDeliverablesEmailAction";
import type { useEditAction } from "#studio/features/admin/hooks/useEditAction";
import type { useInvoiceActions } from "#studio/features/admin/hooks/useInvoiceActions";
import type { usePackageInvoiceActions } from "#studio/features/admin/hooks/usePackageInvoiceActions";
import type { useReceiptActions } from "#studio/features/admin/hooks/useReceiptActions";
import type { useRescheduleAction } from "#studio/features/admin/hooks/useRescheduleAction";
import type { useStatusActions } from "#studio/features/admin/hooks/useStatusActions";

type SessionActionsMenuProps = {
	session: SessionRecord;
	details: SessionActionDetails;
	deleteAction: ReturnType<typeof useDeleteAction>;
	deliverablesEmailAction: ReturnType<typeof useDeliverablesEmailAction>;
	editAction: ReturnType<typeof useEditAction>;
	invoiceActions: ReturnType<typeof useInvoiceActions>;
	packageInvoiceActions: ReturnType<typeof usePackageInvoiceActions>;
	receiptActions: ReturnType<typeof useReceiptActions>;
	rescheduleAction: ReturnType<typeof useRescheduleAction>;
	statusActions: ReturnType<typeof useStatusActions>;
	onOpenDrive: () => void;
	onEditAdminNotes: () => void;
};

function canSetDeliverablesStatusToSent(details: SessionActionDetails) {
	return details.canManageConfirmedSession && details.isPastSession;
}

function SessionPackageStripeInvoiceMenuItem({
	packageInvoiceActions
}: {
	packageInvoiceActions: ReturnType<typeof usePackageInvoiceActions>;
}) {
	if (!packageInvoiceActions.hasStripeCustomer) {
		return null;
	}

	return (
		<>
			<DropdownMenuSeparator />
			<AnimatedDropdownMenuItem
				disabled={packageInvoiceActions.isSendingStripeInvoice}
				onSelect={() => packageInvoiceActions.setIsStripeInvoiceDialogOpen(true)}
				renderIcon={(iconRef) => (
					<BrandStripeIcon
						ref={iconRef}
						size={16}
						aria-hidden
						className="shrink-0 text-current"
					/>
				)}>
				Create Stripe invoice
			</AnimatedDropdownMenuItem>
		</>
	);
}

function getSessionArchiveActionLabel(isUpdatingArchive: boolean, isArchived: boolean) {
	if (isUpdatingArchive) {
		return "Updating archive...";
	}

	if (!isArchived) {
		return "Archive session";
	}

	return "Unarchive session";
}

function DeliverablesControls({
	isMenuOpen,
	session,
	details,
	deliverablesEmailAction,
	statusActions,
	onEditAdminNotes
}: Pick<
	SessionActionsMenuProps,
	"session" | "details" | "deliverablesEmailAction" | "statusActions" | "onEditAdminNotes"
> & { isMenuOpen: boolean }) {
	const adminNotesIconRef = useRef<AnimatedIconHandle | null>(null);

	if (!details.canManageConfirmedSession || !details.isPastSession) return null;

	return (
		<>
			<DropdownMenuLabel className="pb-1 text-sm text-muted-foreground">
				Deliverables
			</DropdownMenuLabel>
			<div className="px-2 pb-2">
				<Tabs value={statusActions.deliverableStatus}>
					<TabsList className="h-auto w-full gap-0 bg-background/60 p-0.5">
						{EDIT_STATUS_OPTIONS.map((option) => {
							const Icon = deliverableStatusIconMap[option];

							const tabLabel =
								option === statusActions.deliverableStatus
									? deliverableStatusLabelMap[option]
									: deliverableStatusTabLabelMap[option];

							const isDeliverAction = option === "completed";

							const isDisabled =
								statusActions.isUpdatingEditStatus ||
								(isDeliverAction
									? deliverablesEmailAction.isEmailingDeliverables
									: statusActions.deliverableStatus === option);

							return (
								<TabsTrigger
									key={option}
									value={option}
									className={cn(
										deliverableStatusTabClassNameMap[option],
										"h-7 gap-1 px-1.5 py-0 data-[state=active]:shadow-none"
									)}
									disabled={isDisabled}
									onClick={() => {
										if (isDeliverAction) {
											deliverablesEmailAction.setIsDeliverablesEmailDialogOpen(true);

											return;
										}

										void statusActions.handleUpdateEditStatus(option);
									}}>
									<Icon aria-hidden />
									{tabLabel}
								</TabsTrigger>
							);
						})}
					</TabsList>
				</Tabs>
			</div>
			<div className="flex flex-col gap-2 px-2 pb-2">
				<SessionEditorAssignment
					isMenuOpen={isMenuOpen}
					session={session}
				/>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="w-full bg-background/60"
					onPointerEnter={() => adminNotesIconRef.current?.startAnimation()}
					onPointerLeave={() => adminNotesIconRef.current?.stopAnimation()}
					onFocus={() => adminNotesIconRef.current?.startAnimation()}
					onBlur={() => adminNotesIconRef.current?.stopAnimation()}
					onClick={onEditAdminNotes}>
					<PenIcon
						ref={adminNotesIconRef}
						aria-hidden
					/>
					Write admin notes
				</Button>
			</div>
			<DropdownMenuSeparator />
		</>
	);
}

export function SessionActionsMenu({
	session,
	details,
	deleteAction,
	deliverablesEmailAction,
	editAction,
	invoiceActions,
	packageInvoiceActions,
	receiptActions,
	rescheduleAction,
	statusActions,
	onOpenDrive,
	onEditAdminNotes
}: SessionActionsMenuProps) {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const showSessionBillingActions = session.packageId === undefined;

	// Menu icon animation refs
	const menuIconRef = useRef<AnimatedIconHandle | null>(null);
	const otherMenuIconRef = useRef<AnimatedIconHandle | null>(null);
	const emailIconRef = useRef<AnimatedIconHandle | null>(null);
	const phoneIconRef = useRef<AnimatedIconHandle | null>(null);
	const isArchived = session.hiddenAt !== undefined;

	const archiveActionLabel = getSessionArchiveActionLabel(
		deleteAction.isUpdatingArchive,
		isArchived
	);

	return (
		<DropdownMenu
			modal={false}
			open={isMenuOpen}
			onOpenChange={setIsMenuOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon-sm"
					className="touch-manipulation"
					onPointerEnter={() => menuIconRef.current?.startAnimation()}
					onPointerLeave={() => menuIconRef.current?.stopAnimation()}
					onFocus={() => menuIconRef.current?.startAnimation()}
					onBlur={() => menuIconRef.current?.stopAnimation()}>
					<span className="sr-only">Open session actions</span>
					<DotsHorizontalIcon
						ref={menuIconRef}
						aria-hidden
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-86 touch-manipulation">
				<DropdownMenuGroup>
					<div className="flex items-center gap-2 px-2 py-1">
						<a
							href={`mailto:${session.email}`}
							aria-label="Email customer"
							title="Email customer"
							className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
							onPointerEnter={() => emailIconRef.current?.startAnimation()}
							onPointerLeave={() => emailIconRef.current?.stopAnimation()}
							onFocus={() => emailIconRef.current?.startAnimation()}
							onBlur={() => emailIconRef.current?.stopAnimation()}>
							<MailFilledIcon
								ref={emailIconRef}
								size={20}
								aria-hidden
							/>
						</a>
						{session.phone ? (
							<a
								href={`tel:${session.phone}`}
								aria-label="Call customer"
								title="Call customer"
								className="flex size-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
								onPointerEnter={() => phoneIconRef.current?.startAnimation()}
								onPointerLeave={() => phoneIconRef.current?.stopAnimation()}
								onFocus={() => phoneIconRef.current?.startAnimation()}
								onBlur={() => phoneIconRef.current?.stopAnimation()}>
								<PhoneVolume
									ref={phoneIconRef}
									size={20}
									aria-hidden
								/>
							</a>
						) : null}
					</div>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				{/* Editors are assigned only after a session ends, alongside the deliverables workflow. */}
				<DeliverablesControls
					isMenuOpen={isMenuOpen}
					session={session}
					details={details}
					deliverablesEmailAction={deliverablesEmailAction}
					statusActions={statusActions}
					onEditAdminNotes={onEditAdminNotes}
				/>
				<DropdownMenuSub>
					<DropdownMenuSubTrigger
						onPointerEnter={() => otherMenuIconRef.current?.startAnimation()}
						onPointerLeave={() => otherMenuIconRef.current?.stopAnimation()}
						onFocus={() => otherMenuIconRef.current?.startAnimation()}
						onBlur={() => otherMenuIconRef.current?.stopAnimation()}>
						<DotsHorizontalIcon
							ref={otherMenuIconRef}
							aria-hidden
						/>
						Other
					</DropdownMenuSubTrigger>
					<DropdownMenuSubContent className="w-80 touch-manipulation">
						{details.canManageConfirmedSession ? (
							<>
								<AnimatedDropdownMenuItem
									onSelect={() => void copyText(details.customerSessionId, "invoice number")}
									renderIcon={(iconRef) => (
										<HashtagIcon
											ref={iconRef}
											size={16}
											aria-hidden
											className="shrink-0 text-current"
										/>
									)}>
									{details.customerSessionId}
								</AnimatedDropdownMenuItem>
								<AnimatedDropdownMenuItem
									onSelect={() => void navigator.clipboard.writeText(String(session._id))}
									renderIcon={(iconRef) => (
										<Stack3Icon
											ref={iconRef}
											size={16}
											aria-hidden
											className="shrink-0 text-current"
										/>
									)}>
									Copy database ID
								</AnimatedDropdownMenuItem>
								<StripeIdCopyMenuItems stripePaymentIntentId={session.stripePaymentIntentId} />
								{showSessionBillingActions ? (
									<>
										<DropdownMenuSeparator />
										{invoiceActions.hasStripeCustomer ? (
											<>
												<AnimatedDropdownMenuItem
													onSelect={() => void receiptActions.handleResendReceipt()}
													renderIcon={(iconRef) => (
														<MailFilledIcon
															ref={iconRef}
															size={16}
															aria-hidden
															className="shrink-0 text-current"
														/>
													)}>
													Resend receipt
												</AnimatedDropdownMenuItem>
												<AnimatedDropdownMenuItem
													disabled={receiptActions.isDownloadingReceipt}
													onSelect={() => void receiptActions.handleDownloadReceipt()}
													renderIcon={(iconRef) => (
														<DownloadIcon
															ref={iconRef}
															size={16}
															aria-hidden
															className="shrink-0 text-current"
														/>
													)}>
													{receiptActions.isDownloadingReceipt
														? "Generating receipt"
														: "Download receipt"}
												</AnimatedDropdownMenuItem>
											</>
										) : null}
										{invoiceActions.hasStripeCustomer ? (
											<AnimatedDropdownMenuItem
												disabled={invoiceActions.isSendingStripeInvoice}
												onSelect={() => invoiceActions.setIsStripeInvoiceDialogOpen(true)}
												renderIcon={(iconRef) => (
													<BrandStripeIcon
														ref={iconRef}
														size={16}
														aria-hidden
														className="shrink-0 text-current"
													/>
												)}>
												Create Stripe invoice
											</AnimatedDropdownMenuItem>
										) : null}
										{invoiceActions.hasStripeBillingInvoices ? (
											<AnimatedDropdownMenuItem
												onSelect={() => invoiceActions.setIsStripeBillingDialogOpen(true)}
												renderIcon={(iconRef) => (
													<BrandStripeIcon
														ref={iconRef}
														size={16}
														aria-hidden
														className="shrink-0 text-current"
													/>
												)}>
												Stripe billing
											</AnimatedDropdownMenuItem>
										) : null}
										{session.stripeCustomerId === undefined ? (
											<LegacyInvoicesSubmenu
												downloadingLegacyCustomInvoiceId={
													invoiceActions.downloadingLegacyCustomInvoiceId
												}
												downloadLabel={
													invoiceActions.isDownloadingInvoice
														? "Generating invoice"
														: "Download invoice"
												}
												isDownloadingInvoice={invoiceActions.isDownloadingInvoice}
												onDownloadInvoice={() => {
													void invoiceActions.handleDownloadInvoice();
												}}
												onOpenCustomInvoices={() =>
													invoiceActions.setIsLegacyCustomInvoicesDialogOpen(true)
												}
											/>
										) : null}
									</>
								) : null}
								{!showSessionBillingActions ? (
									<SessionPackageStripeInvoiceMenuItem
										packageInvoiceActions={packageInvoiceActions}
									/>
								) : null}
							</>
						) : (
							<>
								<AnimatedDropdownMenuItem
									onSelect={() => void navigator.clipboard.writeText(String(session._id))}
									renderIcon={(iconRef) => (
										<Stack3Icon
											ref={iconRef}
											size={16}
											aria-hidden
											className="shrink-0 text-current"
										/>
									)}>
									Copy database ID
								</AnimatedDropdownMenuItem>
								<StripeIdCopyMenuItems stripePaymentIntentId={session.stripePaymentIntentId} />
							</>
						)}
						<DropdownMenuSeparator />
						{canSetDeliverablesStatusToSent(details) ? (
							<AnimatedDropdownMenuItem
								className="hover:text-green focus:text-green"
								disabled={
									statusActions.isUpdatingEditStatus ||
									statusActions.deliverableStatus === "completed"
								}
								onSelect={() => void statusActions.handleUpdateEditStatus("completed")}
								renderIcon={(iconRef) => (
									<MailFilledIcon
										ref={iconRef}
										size={16}
										aria-hidden
										className="shrink-0 text-current"
									/>
								)}>
								Set deliverables status to sent
							</AnimatedDropdownMenuItem>
						) : null}
						<AnimatedDropdownMenuItem
							disabled={
								!details.canGenerateRescheduleLink || rescheduleAction.isGeneratingRescheduleLink
							}
							onSelect={rescheduleAction.openRescheduleLinkDialog}
							renderIcon={(iconRef) => (
								<ClockIcon
									ref={iconRef}
									size={16}
									aria-hidden
									className="shrink-0 text-current"
								/>
							)}>
							Generate reschedule link
						</AnimatedDropdownMenuItem>
					</DropdownMenuSubContent>
				</DropdownMenuSub>
				<DropdownMenuSeparator />
				{details.canManageConfirmedSession ? (
					<AnimatedDropdownMenuItem
						onSelect={onOpenDrive}
						renderIcon={(iconRef) => (
							<BrandGoogleIcon
								ref={iconRef}
								size={16}
								aria-hidden
								className="shrink-0 text-current"
							/>
						)}>
						Google Drive folders
					</AnimatedDropdownMenuItem>
				) : null}
				<AnimatedDropdownMenuItem
					className="hover:text-destructive focus:text-destructive"
					onSelect={() => editAction.setIsEditDialogOpen(true)}
					renderIcon={(iconRef) => (
						<PenIcon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					Edit session
				</AnimatedDropdownMenuItem>
				<AnimatedDropdownMenuItem
					className="hover:text-destructive focus:text-destructive"
					onSelect={() => deleteAction.setIsDeleteDialogOpen(true)}
					renderIcon={(iconRef) => (
						<TrashIcon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					Delete event
				</AnimatedDropdownMenuItem>
				<AnimatedDropdownMenuItem
					disabled={deleteAction.isUpdatingArchive}
					onSelect={() => void deleteAction.handleArchiveChange(!isArchived)}
					renderIcon={(iconRef) => (
						<Stack3Icon
							ref={iconRef}
							size={16}
							aria-hidden
							className="shrink-0 text-current"
						/>
					)}>
					{archiveActionLabel}
				</AnimatedDropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
