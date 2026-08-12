import { useRef } from "react";
import { Button } from "#/components/ui/button";
import ClockIcon from "#/components/ui/clock-icon";
import DotsHorizontalIcon from "#/components/ui/dots-horizontal-icon";
import DownloadIcon from "#/components/ui/download-icon";
import HashtagIcon from "#/components/ui/hashtag-icon";
import MailFilledIcon from "#/components/ui/mail-filled-icon";
import PenIcon from "#/components/ui/pen-icon";
import PhoneVolume from "#/components/ui/phone-volume";
import Stack3Icon from "#/components/ui/stack-3-icon";
import TrashIcon from "#/components/ui/trash-icon";
import type { AnimatedIconHandle } from "#/components/ui/types";
import { cn } from "#/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "#/components/ui/tabs";
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
import { PaymentStatusTabs } from "#studio/features/admin/components/PaymentStatusTabs";
import {
	SessionEditorAssignment,
	type ActiveEditor
} from "#studio/features/admin/components/SessionEditorAssignment";
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
import type { usePaymentActions } from "#studio/features/admin/hooks/usePaymentActions";
import type { useRescheduleAction } from "#studio/features/admin/hooks/useRescheduleAction";
import type { useStatusActions } from "#studio/features/admin/hooks/useStatusActions";

type SessionActionsMenuProps = {
	activeEditors: ActiveEditor[];
	session: SessionRecord;
	details: SessionActionDetails;
	deleteAction: ReturnType<typeof useDeleteAction>;
	deliverablesEmailAction: ReturnType<typeof useDeliverablesEmailAction>;
	editAction: ReturnType<typeof useEditAction>;
	invoiceActions: ReturnType<typeof useInvoiceActions>;
	paymentActions: ReturnType<typeof usePaymentActions>;
	rescheduleAction: ReturnType<typeof useRescheduleAction>;
	statusActions: ReturnType<typeof useStatusActions>;
	onEditEditorNotes: () => void;
};

export function SessionActionsMenu({
	activeEditors,
	session,
	details,
	deleteAction,
	deliverablesEmailAction,
	editAction,
	invoiceActions,
	paymentActions,
	rescheduleAction,
	statusActions,
	onEditEditorNotes
}: SessionActionsMenuProps) {
	// Menu icon animation refs
	const menuIconRef = useRef<AnimatedIconHandle | null>(null);
	const otherMenuIconRef = useRef<AnimatedIconHandle | null>(null);
	const emailIconRef = useRef<AnimatedIconHandle | null>(null);
	const phoneIconRef = useRef<AnimatedIconHandle | null>(null);
	const editorNotesIconRef = useRef<AnimatedIconHandle | null>(null);
	const isArchived = session.hiddenAt !== undefined;
	let archiveActionLabel = "Unarchive session";

	if (deleteAction.isUpdatingArchive) {
		archiveActionLabel = "Updating archive...";
	} else if (!isArchived) {
		archiveActionLabel = "Archive session";
	}

	return (
		<DropdownMenu modal={false}>
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
				className="w-80 touch-manipulation">
				<DropdownMenuGroup>
					<div className="flex items-center gap-2 px-2 py-1">
						<a
							href={`mailto:${session.email}`}
							aria-label="Email customer"
							title="Email customer"
							className={cn(
								"flex size-8 items-center justify-center",
								"rounded-sm",
								"text-muted-foreground",
								"hover:bg-accent hover:text-accent-foreground",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							)}
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
								className={cn(
									"flex size-8 items-center justify-center",
									"rounded-sm",
									"text-muted-foreground",
									"hover:bg-accent hover:text-accent-foreground",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								)}
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
				{details.canManageConfirmedSession ? (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuLabel className="pb-1 text-muted-foreground text-sm">
							Payment status
						</DropdownMenuLabel>
						<div className="px-2 pb-2">
							<PaymentStatusTabs
								disabled={paymentActions.isUpdatingPaidRemainingBalance}
								isPaid={paymentActions.isPaidRemainingBalance}
								onMarkPaid={() => void paymentActions.handleSetPaidRemainingBalance(true)}
								onMarkUnpaid={() => void paymentActions.handleSetPaidRemainingBalance(false)}
							/>
						</div>
					</>
				) : null}
				<DropdownMenuSeparator />
				{details.canManageConfirmedSession && details.isPastSession ? (
					<>
						<DropdownMenuLabel className="pb-1 text-muted-foreground text-sm">
							Deliverables
						</DropdownMenuLabel>
						<div className="px-2 pb-2">
							<Tabs value={statusActions.deliverableStatus}>
								<TabsList className="w-full bg-background/60">
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
												className={deliverableStatusTabClassNameMap[option]}
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
								activeEditors={activeEditors}
								session={session}
							/>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="w-full bg-background/60"
								onPointerEnter={() => editorNotesIconRef.current?.startAnimation()}
								onPointerLeave={() => editorNotesIconRef.current?.stopAnimation()}
								onFocus={() => editorNotesIconRef.current?.startAnimation()}
								onBlur={() => editorNotesIconRef.current?.stopAnimation()}
								onClick={onEditEditorNotes}>
								<PenIcon
									ref={editorNotesIconRef}
									aria-hidden
								/>
								Write editor notes
							</Button>
						</div>
						<DropdownMenuSeparator />
					</>
				) : null}
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
									onSelect={() => void navigator.clipboard.writeText(details.customerSessionId)}
									renderIcon={(iconRef) => (
										<HashtagIcon
											ref={iconRef}
											size={16}
											aria-hidden
											className="shrink-0 text-current"
										/>
									)}>
									Copy invoice number
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
								<DropdownMenuSeparator />
								<AnimatedDropdownMenuItem
									disabled={invoiceActions.isDownloadingInvoice}
									onSelect={() => void invoiceActions.handleDownloadInvoice()}
									renderIcon={(iconRef) => (
										<DownloadIcon
											ref={iconRef}
											size={16}
											aria-hidden
											className="shrink-0 text-current"
										/>
									)}>
									{invoiceActions.isDownloadingInvoice
										? "Generating invoice..."
										: "Download invoice"}
								</AnimatedDropdownMenuItem>
								<AnimatedDropdownMenuItem
									disabled={invoiceActions.isEmailingInvoice}
									onSelect={() => invoiceActions.setIsEmailInvoiceDialogOpen(true)}
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
								<AnimatedDropdownMenuItem
									onSelect={() => invoiceActions.setIsCustomInvoiceDialogOpen(true)}
									renderIcon={(iconRef) => (
										<PenIcon
											ref={iconRef}
											size={16}
											aria-hidden
											className="shrink-0 text-current"
										/>
									)}>
									Create custom invoice
								</AnimatedDropdownMenuItem>
							</>
						) : (
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
						)}
						<DropdownMenuSeparator />
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
				<AnimatedDropdownMenuItem
					className="focus:text-destructive hover:text-destructive"
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
					className="focus:text-destructive hover:text-destructive"
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
