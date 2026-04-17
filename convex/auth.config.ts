import { env } from "./env";

const clerkIssuerUrl = env.CLERK_FRONTEND_API_URL;

const authConfig = {
	providers: [
		{
			domain: clerkIssuerUrl,
			applicationID: "convex",
		},
	],
};

export default authConfig;
