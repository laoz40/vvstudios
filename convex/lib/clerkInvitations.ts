"use node";

import { err, errAsync, ok, ResultAsync } from "neverthrow";
import { z } from "zod";
import { studioSite } from "#/config/sites";
import { env } from "#convex/env";

const clerkInvitationsUrl = "https://api.clerk.com/v1/invitations";

const inviteEmailSchema = z.string().trim().pipe(z.email());

const clerkErrorSchema = z.object({
	errors: z
		.array(
			z.object({
				code: z.string().optional(),
				long_message: z.string().optional(),
				message: z.string().optional()
			})
		)
		.optional()
});

type InviteUserError =
	| { reason: "INVALID_EMAIL" }
	| { reason: "EMAIL_DOMAIN_INVALID" }
	| { reason: "USER_EXISTS" }
	| { reason: "INVITATION_PENDING" }
	| { reason: "CLERK_INVITATION_FAILED" }
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" };

type ClerkInvitationError = Exclude<
	InviteUserError,
	| { reason: "EMAIL_DOMAIN_INVALID" }
	| { reason: "NOT_AUTHENTICATED" }
	| { reason: "NOT_AUTHORIZED" }
>;

type ParsedClerkError = z.infer<typeof clerkErrorSchema>;

function clerkErrorFields(body: ParsedClerkError) {
	const firstError = body.errors?.[0];

	return {
		code: firstError?.code ?? "",
		text: `${firstError?.message ?? ""} ${firstError?.long_message ?? ""}`.toLowerCase()
	};
}

function mapInvitationError(body: ParsedClerkError): ClerkInvitationError {
	const { code, text } = clerkErrorFields(body);

	if (code === "duplicate_record" || text.includes("pending invitation")) {
		return { reason: "INVITATION_PENDING" };
	}

	if (code === "form_identifier_exists" || text.includes("already exists")) {
		return { reason: "USER_EXISTS" };
	}

	if (code === "form_param_format_invalid") {
		return { reason: "INVALID_EMAIL" };
	}

	return { reason: "CLERK_INVITATION_FAILED" };
}

export function parseInviteEmail(email: string) {
	const parsed = inviteEmailSchema.safeParse(email);

	if (!parsed.success) {
		return err({ reason: "INVALID_EMAIL" as const });
	}

	return ok(parsed.data.toLowerCase());
}

export function createClerkInvitation(email: string) {
	return ResultAsync.fromPromise(
		fetch(clerkInvitationsUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				email_address: email,
				notify: true,
				redirect_url: new URL(studioSite.routes.login, env.STRIPE_CHECKOUT_RETURN_URL).href
			})
		}),
		() => ({ reason: "CLERK_INVITATION_FAILED" as const })
	).andThen((response) =>
		ResultAsync.fromPromise(response.json(), () => ({
			reason: "CLERK_INVITATION_FAILED" as const
		})).andThen((body) => {
			if (!response.ok) {
				const parsedBody = clerkErrorSchema.safeParse(body);

				return errAsync(
					mapInvitationError(parsedBody.success ? parsedBody.data : { errors: undefined })
				);
			}

			return ok(null);
		})
	);
}
