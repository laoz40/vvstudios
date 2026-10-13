import { getHostEmails } from "#convex/shared/lib/email/emailSend";

type SessionNotesEmailArgs = {
	clientName: string;
	sessionDate: string;
	notes: string;
	idempotencyKey: string;
} & ({ kind: "admin"; editorEmail: string } | { kind: "editor" });

export function buildSessionNotesEmailRequest(args: SessionNotesEmailArgs, html: string) {
	const label = args.kind === "admin" ? "Admin" : "Editor";
	const recipients = args.kind === "admin" ? [args.editorEmail] : getHostEmails();

	return recipients.length === 0
		? null
		: {
				to: recipients,
				subject: `${label} notes updated: ${args.clientName} (${args.sessionDate})`,
				html,
				idempotencyKey: args.idempotencyKey
			};
}
