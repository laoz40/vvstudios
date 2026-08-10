import { useRef } from "react";
import DotsHorizontalIcon from "#/components/ui/dots-horizontal-icon";
import MailFilledIcon from "#/components/ui/mail-filled-icon";
import PenIcon from "#/components/ui/pen-icon";
import PhoneVolume from "#/components/ui/phone-volume";
import Stack3Icon from "#/components/ui/stack-3-icon";
import { Button } from "#/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from "#/components/ui/dropdown-menu";
import type { AnimatedIconHandle } from "#/components/ui/types";
import { cn } from "#/lib/utils";
import { AnimatedDropdownMenuItem } from "#studio/features/admin/components/AnimatedDropdownMenuItem";
import { PackageActionDialogs } from "#studio/features/admin/components/PackageActionDialogs";
import { PackageOtherActionsMenu } from "#studio/features/admin/components/PackageOtherActionsMenu";
import { PaymentStatusTabs } from "#studio/features/admin/components/PaymentStatusTabs";
import { usePackageActions } from "#studio/features/admin/hooks/usePackageActions";
import {
	getPackageArchiveActionLabel,
	isAdminPackageAdjustmentPaymentEligible,
	type AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";

export function PackageActions({ packageRow }: { packageRow: AdminPackageRow }) {
	const actions = usePackageActions(packageRow);
	const {
		editAction,
		handleAdjustmentPaymentChange,
		handleArchiveChange,
		handleMarkPackageUnpaid,
		isActionPending,
		pendingAction,
		setIsPaymentDialogOpen
	} = actions;
	// Menu icon animation refs
	const menuIconRef = useRef<AnimatedIconHandle | null>(null);
	const emailIconRef = useRef<AnimatedIconHandle | null>(null);
	const phoneIconRef = useRef<AnimatedIconHandle | null>(null);

	return (
		<>
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
						<span className="sr-only">Open package actions</span>
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
								href={`mailto:${packageRow.customerEmail}`}
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
							<a
								href={`tel:${packageRow.customerPhone}`}
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
						</div>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuLabel className="pb-1 text-muted-foreground text-sm">
						Payment status
					</DropdownMenuLabel>
					<div className="px-2 pb-2">
						<PaymentStatusTabs
							disabled={isActionPending}
							isPaid={packageRow.isPaid}
							onMarkPaid={() => setIsPaymentDialogOpen(true)}
							onMarkUnpaid={() => void handleMarkPackageUnpaid()}
						/>
					</div>
					{packageRow.adjustment ? (
						<>
							<DropdownMenuSeparator />
							<DropdownMenuLabel className="pb-1 text-muted-foreground text-sm">
								Adjustment status
							</DropdownMenuLabel>
							<div className="px-2 pb-2">
								<PaymentStatusTabs
									disabled={
										isActionPending ||
										!isAdminPackageAdjustmentPaymentEligible(packageRow.adjustment)
									}
									isPaid={packageRow.adjustment.paymentStatus === "paid"}
									onMarkPaid={() => void handleAdjustmentPaymentChange(true)}
									onMarkUnpaid={() => void handleAdjustmentPaymentChange(false)}
								/>
							</div>
						</>
					) : null}
					<DropdownMenuSeparator />
					<PackageOtherActionsMenu
						actions={actions}
						packageRow={packageRow}
					/>
					<DropdownMenuSeparator />
					<AnimatedDropdownMenuItem
						disabled={isActionPending || editAction.isSaving}
						onSelect={() => editAction.setIsEditDialogOpen(true)}
						renderIcon={(iconRef) => (
							<PenIcon
								ref={iconRef}
								size={16}
								aria-hidden
								className="shrink-0 text-current"
							/>
						)}>
						Edit package
					</AnimatedDropdownMenuItem>
					<AnimatedDropdownMenuItem
						disabled={isActionPending}
						onSelect={() => void handleArchiveChange(packageRow.hiddenAt === undefined)}
						renderIcon={(iconRef) => (
							<Stack3Icon
								ref={iconRef}
								size={16}
								aria-hidden
								className="shrink-0 text-current"
							/>
						)}>
						{getPackageArchiveActionLabel(packageRow, pendingAction)}
					</AnimatedDropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<PackageActionDialogs
				actions={actions}
				packageRow={packageRow}
			/>
		</>
	);
}
