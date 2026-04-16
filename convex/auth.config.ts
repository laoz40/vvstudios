const clerkIssuerUrl = process.env.CLERK_FRONTEND_API_URL

if (!clerkIssuerUrl) {
  throw new Error('Missing CLERK_FRONTEND_API_URL in environment')
}

export default {
  providers: [
    {
      domain: clerkIssuerUrl,
      applicationID: 'convex',
    },
  ],
}
