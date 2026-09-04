/**
 * Employee invitation tests:
 *
 * 1. Invitation authorization
 *    Signed-out users, customers, and editors cannot create Clerk invitations.
 *
 * 2. Invalid email
 *    Malformed addresses are rejected before DNS or Clerk are called.
 *
 * 3. Undeliverable email domain
 *    Addresses whose domain has no MX records are rejected without calling Clerk.
 *
 * 4. Successful invitation
 *    Admins create a Clerk invitation and Clerk is asked to email the user.
 *
 * 5. Existing Clerk user
 *    Clerk identifier conflicts return a stable existing-user error.
 *
 * 6. Pending invitation
 *    Duplicate pending invitations return a stable pending-invitation error.
 *
 * 7. Clerk failure
 *    Unexpected Clerk API failures return a stable invitation-failed error.
 */
import type { UserIdentity } from "convex/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "#convex/_generated/api";
import { createConvexTest } from "#convex/test.setup";

const providerFakes = vi.hoisted(() => ({ fetch: vi.fn(), resolveMx: vi.fn() }));

vi.mock("#convex/env", () => ({
	env: { CLERK_FRONTEND_API_URL: "https://clerk.example", CLERK_SECRET_KEY: "sk_test" }
}));

vi.mock("node:dns/promises", () => ({ resolveMx: providerFakes.resolveMx }));

const adminIdentity = { publicMetadata: { role: "admin" } };
const editorIdentity: UserIdentity = {
	tokenIdentifier: "https://clerk.example|editor-one",
	subject: "editor-one",
	issuer: "https://clerk.example",
	publicMetadata: { role: "editor" }
};
const customerIdentity = { publicMetadata: { role: "customer" } };
const inviteEmail = "new.editor@example.com";

type TestClient = ReturnType<typeof createConvexTest>;

async function seedEditorProfile(t: TestClient, identity: UserIdentity) {
	await t.run(async (ctx) => {
		await ctx.db.insert("editorProfiles", {
			tokenIdentifier: identity.tokenIdentifier,
			displayName: identity.subject,
			email: `${identity.subject}@example.com`,
			isActive: true,
			lastAssignedAt: null,
			totalEdits: 0
		});
	});
}

function jsonResponse(status: number, body: unknown) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" }
	});
}

describe("employee invitations", () => {
	beforeEach(() => {
		providerFakes.fetch.mockReset();
		providerFakes.resolveMx.mockReset();
		providerFakes.resolveMx.mockResolvedValue([{ exchange: "mx.example.com", priority: 10 }]);
		vi.stubGlobal("fetch", providerFakes.fetch);
	});

	test("rejects unauthorized callers without contacting Clerk", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);

		const anonymousResult = await t.action(api.employeeInvitations.inviteUser, {
			email: inviteEmail
		});
		const customerResult = await t
			.withIdentity(customerIdentity)
			.action(api.employeeInvitations.inviteUser, { email: inviteEmail });
		const editorResult = await t
			.withIdentity(editorIdentity)
			.action(api.employeeInvitations.inviteUser, { email: inviteEmail });

		expect(anonymousResult).toEqual([{ reason: "NOT_AUTHENTICATED" }, null]);
		expect(customerResult).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);
		expect(editorResult).toEqual([{ reason: "NOT_AUTHORIZED" }, null]);
		expect(providerFakes.resolveMx).not.toHaveBeenCalled();
		expect(providerFakes.fetch).not.toHaveBeenCalled();
	});

	test("rejects invalid email before DNS or Clerk", async () => {
		const t = createConvexTest().withIdentity(adminIdentity);

		expect(await t.action(api.employeeInvitations.inviteUser, { email: "not-an-email" })).toEqual([
			{ reason: "INVALID_EMAIL" },
			null
		]);
		expect(providerFakes.resolveMx).not.toHaveBeenCalled();
		expect(providerFakes.fetch).not.toHaveBeenCalled();
	});

	test("rejects addresses whose domain cannot receive mail", async () => {
		providerFakes.resolveMx.mockRejectedValue(new Error("ENOTFOUND"));
		const t = createConvexTest().withIdentity(adminIdentity);

		expect(await t.action(api.employeeInvitations.inviteUser, { email: inviteEmail })).toEqual([
			{ reason: "EMAIL_DOMAIN_INVALID" },
			null
		]);
		expect(providerFakes.fetch).not.toHaveBeenCalled();
	});

	test("creates a Clerk invitation for an admin", async () => {
		providerFakes.fetch.mockResolvedValue(
			jsonResponse(200, { id: "inv_123", email_address: inviteEmail })
		);
		const t = createConvexTest().withIdentity(adminIdentity);

		expect(await t.action(api.employeeInvitations.inviteUser, { email: inviteEmail })).toEqual([
			null,
			{ invitedEmail: inviteEmail }
		]);
		expect(providerFakes.fetch).toHaveBeenCalledWith(
			"https://api.clerk.com/v1/invitations",
			expect.objectContaining({
				method: "POST",
				headers: { Authorization: "Bearer sk_test", "Content-Type": "application/json" },
				body: JSON.stringify({ email_address: inviteEmail, notify: true })
			})
		);
	});

	test("maps an existing Clerk user to USER_EXISTS", async () => {
		providerFakes.fetch.mockResolvedValue(
			jsonResponse(422, { errors: [{ code: "form_identifier_exists", message: "already exists" }] })
		);
		const t = createConvexTest().withIdentity(adminIdentity);

		expect(await t.action(api.employeeInvitations.inviteUser, { email: inviteEmail })).toEqual([
			{ reason: "USER_EXISTS" },
			null
		]);
	});

	test("maps a pending invitation to INVITATION_PENDING", async () => {
		providerFakes.fetch.mockResolvedValue(
			jsonResponse(400, {
				errors: [
					{
						code: "duplicate_record",
						long_message: "There are already pending invitations for the following email addresses"
					}
				]
			})
		);
		const t = createConvexTest().withIdentity(adminIdentity);

		expect(await t.action(api.employeeInvitations.inviteUser, { email: inviteEmail })).toEqual([
			{ reason: "INVITATION_PENDING" },
			null
		]);
	});

	test("maps unexpected Clerk failures to CLERK_INVITATION_FAILED", async () => {
		providerFakes.fetch.mockResolvedValue(
			jsonResponse(500, { errors: [{ code: "internal_clerk_error" }] })
		);
		const t = createConvexTest().withIdentity(adminIdentity);

		expect(await t.action(api.employeeInvitations.inviteUser, { email: inviteEmail })).toEqual([
			{ reason: "CLERK_INVITATION_FAILED" },
			null
		]);
	});
});
