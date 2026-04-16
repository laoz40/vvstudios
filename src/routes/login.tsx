import { SignIn, useAuth } from '@clerk/clerk-react'
import { Navigate, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const { isLoaded, userId } = useAuth()

  if (!isLoaded) {
    return (
      <main>
        <p>Loading sign-in...</p>
      </main>
    )
  }

  if (userId) {
    return <Navigate to="/admin" />
  }

  return (
    <main>
      <h1>Administrator login</h1>
			<p>Authorised access only. If you want to create a booking, please go to the <a href="/book">booking page</a>. No login required.</p>
      <SignIn
        routing="hash"
        forceRedirectUrl="/admin"
        fallbackRedirectUrl="/admin"
        signUpForceRedirectUrl="/admin"
        signUpFallbackRedirectUrl="/admin"
      />
    </main>
  )
}
