import { Activity, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Textarea } from "#/components/ui/textarea";
import type { Doc } from "#convex/_generated/dataModel";
import {
	FIRST_TIME_DELIVERABLES_INTRO_MESSAGE,
	REPEAT_CUSTOMER_DELIVERABLES_INTRO_MESSAGE,
	type DeliverablesIntroMessageOption,
} from "#studio/features/deliverables-email/lib/intro-messages";

export type DeliverablesEmailDialogProps = {
	bookingEmail: string;
	bookingId: Doc<"bookings">["_id"];
	bookingName: string;
	driveLink: string;
	introMessage: string;
	isSending: boolean;
	onDriveLinkChange: (driveLink: string) => void;
	onIntroMessageChange: (introMessage: string) => void;
	onOpenChange: (open: boolean) => void;
	onSend: () => void;
	open: boolean;
};

export function DeliverablesEmailDialog({
	bookingEmail,
	bookingId,
	bookingName,
	driveLink,
	introMessage,
	isSending,
	onDriveLinkChange,
	onIntroMessageChange,
	onOpenChange,
	onSend,
	open,
}: DeliverablesEmailDialogProps) {
	const [selectedIntroOption, setSelectedIntroOption] = useState<DeliverablesIntroMessageOption>(
		() => getIntroMessageOption(introMessage),
	);
	const [customIntroMessage, setCustomIntroMessage] = useState(
		selectedIntroOption === "custom" ? introMessage : "",
	);

	function handleIntroOptionChange(option: DeliverablesIntroMessageOption) {
		setSelectedIntroOption(option);

		if (option === "first-time") {
			onIntroMessageChange(FIRST_TIME_DELIVERABLES_INTRO_MESSAGE);
			return;
		}

		if (option === "repeat-customer") {
			onIntroMessageChange(REPEAT_CUSTOMER_DELIVERABLES_INTRO_MESSAGE);
			return;
		}

		onIntroMessageChange(customIntroMessage);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (isSending && !nextOpen) {
					return;
				}

				onOpenChange(nextOpen);
			}}>
			<DialogContent
				className="sm:max-w-lg"
				onInteractOutside={(event) => {
					if (isSending) {
						event.preventDefault();
					}
				}}
				onEscapeKeyDown={(event) => {
					if (isSending) {
						event.preventDefault();
					}
				}}>
				<DialogClose asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="absolute top-2 right-2"
						aria-label="Close deliverables email dialog"
						disabled={isSending}>
						<X />
					</Button>
				</DialogClose>

				<DialogHeader className="text-left">
					<DialogTitle>Send Deliverables Email</DialogTitle>
				</DialogHeader>

				<div className="rounded-lg border bg-muted/40 p-4">
					<dl className="grid gap-3 text-sm sm:grid-cols-2">
						<div className="grid gap-1">
							<dt className="text-muted-foreground">Customer</dt>
							<dd className="font-medium">{bookingName}</dd>
						</div>
						<div className="grid gap-1">
							<dt className="text-muted-foreground">Email</dt>
							<dd className="break-all font-medium">{bookingEmail}</dd>
						</div>
					</dl>
				</div>

				<FieldGroup>
					<Field>
						<FieldLabel>Intro message</FieldLabel>
						<RadioGroup
							value={selectedIntroOption}
							onValueChange={(value) =>
								handleIntroOptionChange(value as DeliverablesIntroMessageOption)
							}
							className="gap-2"
							disabled={isSending}>
							<FieldLabel className="w-full rounded-md border p-3">
								<RadioGroupItem value="first-time" />
								<span className="text-sm font-normal leading-5">
									{FIRST_TIME_DELIVERABLES_INTRO_MESSAGE}
								</span>
							</FieldLabel>
							<FieldLabel className="w-full rounded-md border p-3">
								<RadioGroupItem value="repeat-customer" />
								<span className="text-sm font-normal leading-5">
									{REPEAT_CUSTOMER_DELIVERABLES_INTRO_MESSAGE}
								</span>
							</FieldLabel>
							<FieldLabel className="w-full rounded-md border p-3">
								<RadioGroupItem value="custom" />
								<span className="text-sm font-normal leading-5">Custom message</span>
							</FieldLabel>
						</RadioGroup>
						<Activity mode={selectedIntroOption === "custom" ? "visible" : "hidden"}>
							<Textarea
								placeholder="Write the opening message for this customer..."
								value={customIntroMessage}
								onChange={(event) => {
									setCustomIntroMessage(event.target.value);
									onIntroMessageChange(event.target.value);
								}}
								disabled={isSending}
							/>
						</Activity>
					</Field>

					<Field>
						<FieldLabel htmlFor={`deliverables-drive-link-${bookingId}`}>
							Google Drive link
						</FieldLabel>
						<Input
							id={`deliverables-drive-link-${bookingId}`}
							type="url"
							placeholder="https://drive.google.com/drive/folders/..."
							value={driveLink}
							onChange={(event) => onDriveLinkChange(event.target.value)}
							disabled={isSending}
						/>
					</Field>
				</FieldGroup>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isSending}>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={onSend}
						disabled={isSending || !driveLink.trim() || !introMessage.trim()}>
						{isSending ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{isSending ? "Sending..." : "Send email"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function getIntroMessageOption(introMessage: string): DeliverablesIntroMessageOption {
	if (introMessage === FIRST_TIME_DELIVERABLES_INTRO_MESSAGE) {
		return "first-time";
	}

	if (introMessage === REPEAT_CUSTOMER_DELIVERABLES_INTRO_MESSAGE) {
		return "repeat-customer";
	}

	return "custom";
}
