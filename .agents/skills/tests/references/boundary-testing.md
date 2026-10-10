# Boundary testing

Put pure lib tests in `convex/<feature>/lib/tests/` or `convex/shared/lib/tests/`. Put tests using `createConvexTest` or registered endpoints in `convex/tests/` (cross-feature flows and shared fixtures like `insertDocumentDefaults.ts`). Call the real endpoint and stub only the external transport. Keep SDK request construction, domain logic, and rendering real.

Use these existing examples instead of copying fixtures:

- Stripe, [stripeAdjustmentInvoice.test.ts](../../../../convex/tests/stripeAdjustmentInvoice.test.ts) and [checkoutCreation.test.ts](../../../../convex/tests/checkoutCreation.test.ts) spy on `Stripe.StripeResource.prototype._makeRequest`. The real Stripe resource constructs the request; the spy supplies the external response or failure.
- Google Calendar, [packageCalendarErrors.test.ts](../../../../convex/tests/packageCalendarErrors.test.ts) constructs the actual Google SDK client with `fetchImplementation` and `retry: false`. A `google.calendar` factory spy returns that client. The HTTP stub supplies responses or failures while the SDK still builds requests.
- PDF and email, [packagePaidEmailErrors.test.ts](../../../../convex/tests/packagePaidEmailErrors.test.ts) runs real PDF rendering and spies on `globalThis.fetch` for email delivery failures. Restore spies after each test. The `pdf` ESM export from `@react-pdf/renderer` is nonconfigurable, so spying on that export fails. Use the real renderer and mock email transport as this test does.

Assert caller-visible results and persisted failure state, not internal collaborator calls. Tests in `convex/tests/` must satisfy `anti-slop/no-module-mocking`; use boundary spies rather than module replacements.
