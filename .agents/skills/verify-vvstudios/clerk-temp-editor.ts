import { ensureClerkTestingEnv, getE2eClerkSecretKey } from "../../../e2e/helpers/admin-auth.ts";

const CLERK_USERS_URL = "https://api.clerk.com/v1/users";

export type TempClerkEditor = {
	userId: string;
	email: string;
	displayName: string;
};

function clerkSecret() {
	const secret = getE2eClerkSecretKey();

	if (!secret) {
		throw new Error("Missing E2E_CLERK_SECRET_KEY or CLERK_SECRET_KEY");
	}

	return secret;
}

async function clerkJson(response: Response) {
	return (await response.json()) as {
		id?: string;
		errors?: Array<{ code?: string; message?: string }>;
	};
}

export async function createTempClerkEditor(): Promise<TempClerkEditor> {
	ensureClerkTestingEnv();
	const stamp = Date.now();
	const email = `vv-verify-editor-${stamp}+clerk_test@example.com`;
	const displayName = `VVVerify ${stamp}`;

	const response = await fetch(CLERK_USERS_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${clerkSecret()}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			email_address: [email],
			first_name: "VVVerify",
			last_name: String(stamp),
			skip_password_requirement: true
		})
	});

	const body = await clerkJson(response);

	if (!response.ok || !body.id) {
		const code = body.errors?.[0]?.code ?? `http_${response.status}`;
		throw new Error(`Clerk create user failed (${code})`);
	}

	return { userId: body.id, email, displayName };
}

export async function deleteTempClerkEditor(userId: string) {
	ensureClerkTestingEnv();
	const response = await fetch(`${CLERK_USERS_URL}/${userId}`, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${clerkSecret()}` }
	});

	if (!response.ok && response.status !== 404) {
		throw new Error(`Clerk delete user failed (http_${response.status})`);
	}
}
