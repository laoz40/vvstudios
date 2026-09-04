import { useEffect, useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "#/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import {
	getInviteUserErrorMessage,
	inviteEmailSchema
} from "#studio/features/admin/lib/editor-management";

type InviteUserDialogProps = { onOpenChange: (open: boolean) => void; open: boolean };

export function InviteUserDialog({ onOpenChange, open }: InviteUserDialogProps) {
	const inviteUser = useAction(api.employeeInvitations.inviteUser);
	const [email, setEmail] = useState("");
	const [fieldError, setFieldError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Clear the draft whenever the invite dialog opens.
	useEffect(() => {
		if (open) {
			setEmail("");
			setFieldError(null);
			setIsSubmitting(false);
		}
	}, [open]);

	async function handleSubmit() {
		const parsedEmail = inviteEmailSchema.safeParse(email);
		if (!parsedEmail.success) {
			setFieldError(parsedEmail.error.issues[0]?.message ?? "Please enter a valid email address.");
			return;
		}

		setFieldError(null);
		setIsSubmitting(true);
		const [error, result] = await tryCatch(inviteUser({ email: parsedEmail.data }));
		setIsSubmitting(false);

		if (error !== null) {
			toast.error(getInviteUserErrorMessage(error.reason));
			return;
		}

		toast.success(`Invitation sent to ${result.invitedEmail}`);
		onOpenChange(false);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Invite editor</DialogTitle>
					<DialogDescription>This will send an invitation email for the editor to create an account.</DialogDescription>
				</DialogHeader>
				<Field data-invalid={fieldError !== null || undefined}>
					<FieldLabel htmlFor="invite-user-email">Email</FieldLabel>
					<Input
						id="invite-user-email"
						type="email"
						autoComplete="email"
						value={email}
						disabled={isSubmitting}
						onChange={(event) => {
							setEmail(event.target.value);
							if (fieldError !== null) setFieldError(null);
						}}
					/>
					{fieldError !== null ? <FieldError>{fieldError}</FieldError> : null}
				</Field>
				<DialogFooter>
					<DialogClose asChild>
						<Button
							variant="outline"
							disabled={isSubmitting}>
							Cancel
						</Button>
					</DialogClose>
					<Button
						disabled={isSubmitting}
						onClick={() => void handleSubmit()}>
						{isSubmitting ? (
							<LoaderCircleIcon
								data-icon="inline-start"
								className="animate-spin"
							/>
						) : null}
						{isSubmitting ? "Sending" : "Send invitation"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
