import { ClerkProvider } from '@clerk/clerk-react'
import { env } from '../../env'

const PUBLISHABLE_KEY = env.VITE_CLERK_PUBLISHABLE_KEY

export default function AppClerkProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      signInUrl="/login"
      signInForceRedirectUrl="/admin"
      signUpForceRedirectUrl="/admin"
      afterSignOutUrl="/login"
    >
      {children}
    </ClerkProvider>
  )
}
