import { useMemo } from "react";
import { Store, useSelector } from "@tanstack/react-store";
import { LoaderCircle, X } from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from "#/components/ui/accordion";
import { Button } from "#/components/ui/button";
import { AdminAddonOptions } from "#studio/features/admin/components/AdminAddonOptions";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Textarea } from "#/components/ui/textarea";
import type { Doc } from "#convex/_generated/dataModel";
import { DURATION_OPTIONS, SERVICES } from "#studio/features/booking-form/lib/booking-form-model";
import {
	adminOptionButtonClassName,
	adminOptionRowClassName
} from "#studio/features/admin/lib/admin-form-styles";
import {
	formatAudAmount,
	getAudAmountRowShowCents
} from "#studio/features/admin/lib/remaining-balance";
import { getBookingTotal } from "#studio/features/booking-form/lib/booking-pricing";
import { useSessionEditPricingValues } from "#studio/features/admin/hooks/useSessionEditPricingValues";
import {
	SessionEditDraftStoreContext,
	buildSessionEditDraft,
	setSessionEditDraftField,
	useSessionEditDraftStore,
	type SessionEditDraft
} from "#studio/features/admin/lib/session-edit-draft-store";
import { toOptionId } from "#studio/lib/bookingdatetime";

export type { SessionEditDraft } from "#studio/features/admin/lib/session-edit-draft-store";

type SessionRecord = Doc<"bookings">;

export type SessionEditDialogProps = {
	open: boolean;
	session: SessionRecord;
	bookingId: string;
	onOpenChange: (open: boolean) => void;
	onSave: (values: SessionEditDraft) => Promise<void>;
	isSaving: boolean;
};

const compactFieldClassName = "grid gap-1.5";

const accordionTriggerClassName = "!py-3 !text-base !font-bold hover:!text-primary";

const accordionContentClassName = "space-y-3 pb-3 pt-1 text-sm md:text-sm md:pb-3";

function formatSignedPriceDifference(diff: number, showCents: boolean) {
	const sign = diff > 0 ? "+" : "-";

	return `(${sign}${formatAudAmount(Math.abs(diff), { showCents })})`;
}

type SessionEditFieldProps = { isSaving: boolean };

function SessionEditNameField({ isSaving }: SessionEditFieldProps) {
	const store = useSessionEditDraftStore();
	const name = useSelector(store, (draft) => draft.name);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-session-name">Customer name</Label>
			<Input
				id="edit-session-name"
				name="name"
				autoComplete="name"
				value={name}
				onChange={(event) => {
					setSessionEditDraftField(store, "name", event.target.value);
				}}
				required
				disabled={isSaving}
			/>
		</div>
	);
}

function SessionEditAccountNameField({ isSaving }: SessionEditFieldProps) {
	const store = useSessionEditDraftStore();
	const accountName = useSelector(store, (draft) => draft.accountName);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-session-account-name">Account name</Label>
			<Input
				id="edit-session-account-name"
				name="accountName"
				autoComplete="organization"
				value={accountName}
				onChange={(event) => {
					setSessionEditDraftField(store, "accountName", event.target.value);
				}}
				required
				disabled={isSaving}
			/>
		</div>
	);
}

function SessionEditAbnField({ isSaving }: SessionEditFieldProps) {
	const store = useSessionEditDraftStore();
	const abn = useSelector(store, (draft) => draft.abn);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-session-abn">ABN</Label>
			<Input
				id="edit-session-abn"
				name="abn"
				autoComplete="off"
				spellCheck={false}
				value={abn}
				onChange={(event) => {
					setSessionEditDraftField(store, "abn", event.target.value);
				}}
				inputMode="numeric"
				placeholder="Optional"
				disabled={isSaving}
			/>
		</div>
	);
}

function SessionEditEmailField({ isSaving }: SessionEditFieldProps) {
	const store = useSessionEditDraftStore();
	const email = useSelector(store, (draft) => draft.email);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-session-email">Email</Label>
			<Input
				id="edit-session-email"
				name="email"
				type="email"
				autoComplete="email"
				spellCheck={false}
				value={email}
				onChange={(event) => {
					setSessionEditDraftField(store, "email", event.target.value);
				}}
				required
				disabled={isSaving}
			/>
		</div>
	);
}

function SessionEditPhoneField({ isSaving }: SessionEditFieldProps) {
	const store = useSessionEditDraftStore();
	const phone = useSelector(store, (draft) => draft.phone);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-session-phone">Phone number</Label>
			<Input
				id="edit-session-phone"
				name="phone"
				type="tel"
				autoComplete="tel"
				inputMode="tel"
				value={phone}
				onChange={(event) => {
					setSessionEditDraftField(store, "phone", event.target.value);
				}}
				required
				disabled={isSaving}
			/>
		</div>
	);
}

function SessionEditNotesField({ isSaving }: SessionEditFieldProps) {
	const store = useSessionEditDraftStore();
	const notes = useSelector(store, (draft) => draft.notes);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-session-notes">Client notes</Label>
			<Textarea
				id="edit-session-notes"
				name="notes"
				autoComplete="off"
				rows={2}
				value={notes}
				onChange={(event) => {
					setSessionEditDraftField(store, "notes", event.target.value);
				}}
				placeholder="Optional"
				disabled={isSaving}
			/>
		</div>
	);
}

function SessionEditDateField({ isSaving }: SessionEditFieldProps) {
	const store = useSessionEditDraftStore();
	const date = useSelector(store, (draft) => draft.date);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-session-date">Session date</Label>
			<Input
				id="edit-session-date"
				name="date"
				type="date"
				autoComplete="off"
				value={date}
				onChange={(event) => {
					setSessionEditDraftField(store, "date", event.target.value);
				}}
				required
				disabled={isSaving}
			/>
		</div>
	);
}

function SessionEditTimeField({ isSaving }: SessionEditFieldProps) {
	const store = useSessionEditDraftStore();
	const time = useSelector(store, (draft) => draft.time);

	return (
		<div className={compactFieldClassName}>
			<Label htmlFor="edit-session-time">Session time</Label>
			<Input
				id="edit-session-time"
				name="time"
				type="time"
				autoComplete="off"
				value={time}
				onChange={(event) => {
					setSessionEditDraftField(store, "time", event.target.value);
				}}
				required
				disabled={isSaving}
			/>
		</div>
	);
}

function SessionEditDurationField({ isSaving }: SessionEditFieldProps) {
	const store = useSessionEditDraftStore();
	const duration = useSelector(store, (draft) => draft.duration);

	return (
		<div className="grid gap-2">
			<Label>Session duration</Label>
			<RadioGroup
				value={duration}
				onValueChange={(value) => {
					const nextDuration = DURATION_OPTIONS.find((option) => option === value);

					if (nextDuration) {
						setSessionEditDraftField(store, "duration", nextDuration);
					}
				}}
				className={adminOptionRowClassName}>
				{DURATION_OPTIONS.map((option) => {
					const optionId = `edit-duration-${toOptionId(option)}`;

					return (
						<label
							key={option}
							htmlFor={optionId}
							className={adminOptionButtonClassName}>
							<RadioGroupItem
								id={optionId}
								value={option}
								disabled={isSaving}
								className="sr-only"
							/>
							{option}
						</label>
					);
				})}
			</RadioGroup>
		</div>
	);
}

function SessionEditServiceField({ isSaving }: SessionEditFieldProps) {
	const store = useSessionEditDraftStore();
	const service = useSelector(store, (draft) => draft.service);

	return (
		<div className="grid gap-2">
			<Label>Service</Label>
			<RadioGroup
				value={service}
				onValueChange={(value) => {
					const nextService = SERVICES.find((option) => option === value);

					if (nextService) {
						setSessionEditDraftField(store, "service", nextService);
					}
				}}
				className={adminOptionRowClassName}>
				{SERVICES.map((option) => {
					const optionId = `edit-service-${toOptionId(option)}`;

					return (
						<label
							key={option}
							htmlFor={optionId}
							className={adminOptionButtonClassName}>
							<RadioGroupItem
								id={optionId}
								value={option}
								disabled={isSaving}
								className="sr-only"
							/>
							{option}
						</label>
					);
				})}
			</RadioGroup>
		</div>
	);
}

type SessionEditAddonValues = Pick<
	SessionEditDraft,
	| "addons"
	| "clipsPackageQuantity"
	| "completeEditQuantity"
	| "essentialEditQuantity"
	| "handcraftedClipsQuantity"
>;

function getSessionEditAddonValues(draft: SessionEditDraft): SessionEditAddonValues {
	return {
		addons: draft.addons,
		essentialEditQuantity: draft.essentialEditQuantity,
		completeEditQuantity: draft.completeEditQuantity,
		clipsPackageQuantity: draft.clipsPackageQuantity,
		handcraftedClipsQuantity: draft.handcraftedClipsQuantity
	};
}

function getSessionEditAddonValuesKey(values: SessionEditAddonValues): string {
	return [
		values.addons.join("\0"),
		values.essentialEditQuantity,
		values.completeEditQuantity,
		values.clipsPackageQuantity,
		values.handcraftedClipsQuantity
	].join("|");
}

function areSessionEditAddonValuesEqual(
	left: SessionEditAddonValues,
	right: SessionEditAddonValues
) {
	return getSessionEditAddonValuesKey(left) === getSessionEditAddonValuesKey(right);
}

function SessionEditAddonsSection({
	bookingId,
	isSaving
}: {
	bookingId: string;
	isSaving: boolean;
}) {
	const store = useSessionEditDraftStore();

	const addonValues = useSelector(store, (draft) => getSessionEditAddonValues(draft), {
		compare: areSessionEditAddonValuesEqual
	});

	return (
		<AdminAddonOptions
			key={bookingId}
			addons={addonValues.addons}
			essentialEditQuantity={addonValues.essentialEditQuantity}
			completeEditQuantity={addonValues.completeEditQuantity}
			clipsPackageQuantity={addonValues.clipsPackageQuantity}
			handcraftedClipsQuantity={addonValues.handcraftedClipsQuantity}
			disabled={isSaving}
			idPrefix="edit-addon"
			showLabel={false}
			onChange={(nextValues) => {
				store.setState((current) => ({ ...current, ...nextValues }));
			}}
		/>
	);
}

function SessionEditPriceSummary({ originalPrice }: { originalPrice: number }) {
	const pricingValues = useSessionEditPricingValues();
	const newPrice = getBookingTotal(pricingValues);
	const priceDifference = newPrice - originalPrice;
	const showPriceCents = getAudAmountRowShowCents([originalPrice, newPrice, priceDifference]);

	return (
		<div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t pt-3 text-sm tabular-nums">
			<p>
				Total:{" "}
				<span className="font-medium">
					{formatAudAmount(originalPrice, { showCents: showPriceCents })}
				</span>
			</p>
			{priceDifference !== 0 ? (
				<p>
					New:{" "}
					<span className="font-medium">
						{formatAudAmount(newPrice, { showCents: showPriceCents })}
					</span>{" "}
					<span className="text-muted-foreground">
						{formatSignedPriceDifference(priceDifference, showPriceCents)}
					</span>
				</p>
			) : null}
		</div>
	);
}

type SessionEditDialogFormProps = {
	session: SessionRecord;
	bookingId: string;
	onOpenChange: (open: boolean) => void;
	onSave: (values: SessionEditDraft) => Promise<void>;
	isSaving: boolean;
};

function SessionEditDialogForm({
	session,
	bookingId,
	onOpenChange,
	onSave,
	isSaving
}: SessionEditDialogFormProps) {
	const draftStore = useMemo(() => new Store(buildSessionEditDraft(session)), [session]);
	const originalPrice = getBookingTotal(buildSessionEditDraft(session));

	return (
		<SessionEditDraftStoreContext value={draftStore}>
			<form
				className="flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain pr-1"
				data-lenis-prevent
				onSubmit={(event) => {
					event.preventDefault();
					void onSave(draftStore.state);
				}}>
				<Accordion
					type="single"
					collapsible
					className="w-full">
					<AccordionItem value="client-details">
						<AccordionTrigger className={accordionTriggerClassName}>
							Client details
						</AccordionTrigger>
						<AccordionContent className={accordionContentClassName}>
							<div className="grid gap-3 sm:grid-cols-2">
								<SessionEditNameField isSaving={isSaving} />
								<SessionEditAccountNameField isSaving={isSaving} />
								<SessionEditAbnField isSaving={isSaving} />
								<SessionEditEmailField isSaving={isSaving} />
								<SessionEditPhoneField isSaving={isSaving} />
							</div>
							<SessionEditNotesField isSaving={isSaving} />
						</AccordionContent>
					</AccordionItem>

					<AccordionItem value="session-details">
						<AccordionTrigger className={accordionTriggerClassName}>
							Session details
						</AccordionTrigger>
						<AccordionContent className={accordionContentClassName}>
							<div className="grid gap-3 sm:grid-cols-2">
								<SessionEditDateField isSaving={isSaving} />
								<SessionEditTimeField isSaving={isSaving} />
							</div>

							<div className="grid gap-3 sm:grid-cols-2">
								<SessionEditDurationField isSaving={isSaving} />
								<SessionEditServiceField isSaving={isSaving} />
							</div>
						</AccordionContent>
					</AccordionItem>

					<AccordionItem value="addons">
						<AccordionTrigger className={accordionTriggerClassName}>Add-ons</AccordionTrigger>
						<AccordionContent className={accordionContentClassName}>
							<SessionEditAddonsSection
								bookingId={bookingId}
								isSaving={isSaving}
							/>
						</AccordionContent>
					</AccordionItem>
				</Accordion>

				<SessionEditPriceSummary originalPrice={originalPrice} />

				<DialogFooter className="gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSaving}>
						Discard changes
					</Button>
					<Button
						type="submit"
						variant="destructive"
						disabled={isSaving}>
						{isSaving ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{isSaving ? "Saving" : "I am sure I want to make permanent changes"}
					</Button>
				</DialogFooter>
			</form>
		</SessionEditDraftStoreContext>
	);
}

export function SessionEditDialog({
	open,
	session,
	bookingId,
	onOpenChange,
	onSave,
	isSaving
}: SessionEditDialogProps) {
	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (isSaving && !nextOpen) {
					return;
				}

				onOpenChange(nextOpen);
			}}>
			<DialogContent
				className="flex max-h-dvh flex-col gap-4 overflow-hidden sm:max-w-3xl"
				onInteractOutside={(event) => {
					if (isSaving) {
						event.preventDefault();
					}
				}}
				onEscapeKeyDown={(event) => {
					if (isSaving) {
						event.preventDefault();
					}
				}}>
				<DialogClose asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute top-2 right-2"
						aria-label="Close edit session dialog"
						disabled={isSaving}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="space-y-1 text-left">
					<DialogTitle>Edit session</DialogTitle>
					<DialogDescription>
						This will make changes to session {bookingId}. There is no turning back from this. USE
						CAUTION.
					</DialogDescription>
				</DialogHeader>

				{open ? (
					<SessionEditDialogForm
						key={bookingId}
						session={session}
						bookingId={bookingId}
						onOpenChange={onOpenChange}
						onSave={onSave}
						isSaving={isSaving}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
