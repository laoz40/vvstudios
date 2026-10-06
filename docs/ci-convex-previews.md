# CI Convex previews

PR smoke tests use one Convex preview named `e2e-pr-<PR number>`. Every attempt uses `convex deploy --preview-create`, which deletes any previous preview with that name and provisions an empty database. Different PRs do not share a backend.

The E2E job holds a per-PR GitHub concurrency lock through provisioning, deployment, regenerated API typechecking, and tests. `cancel-in-progress: false` lets an active attempt finish before another attempt replaces its backend. GitHub may replace a pending attempt with a newer pending attempt. It does not promise to execute every queued revision. Do not add workflow-level cancellation that interrupts these jobs.

## One-time setup

Reuse the project containing the existing test E2E deployment. Its deployment-specific variables do not automatically become defaults for new previews.

1. In Convex Project Settings, create a preview deploy key. Store it as GitHub Actions repository secret `CONVEX_E2E_PREVIEW_DEPLOY_KEY`. Keep the existing production and shared-E2E keys unchanged.
2. In Project Settings, Environment Variable Defaults, configure the **Preview** deployment type only. Leave Production and Development defaults unchanged. Supply all required variables in `convex/env.ts` using test-only credentials.
3. Set `STRIPE_CHECKOUT_RETURN_URL` to `http://localhost:3000/booking-complete`. The application adds the Stripe session query parameter.
4. Set GitHub repository variables `E2E_GOOGLE_CALENDAR_ID` and `E2E_GOOGLE_DRIVE_ROOT_FOLDER_ID` to the dedicated test resources. The preview calendar and every availability calendar must match the approved test calendar.
5. Audit Google OAuth access, Drive folder, Calendar host recipients, and Resend credentials/sender. These must not write production data or send to production recipients. Review the Stripe test account's existing webhook destinations too. Unpaid checkout sessions can later produce expiration events. Do not route those sessions into production or the old shared E2E backend. After this audit, set GitHub variable `E2E_PREVIEW_INTEGRATIONS_CONFIRMED=true`.
6. Keep the existing `E2E_VITE_CLERK_PUBLISHABLE_KEY` and `E2E_VITE_STRIPE_PUBLISHABLE_KEY` variables. They must use test keys and match the backend test accounts.

The smoke tests stop at the embedded payment modal. They do not complete payments, prove webhook routing, or test paid-booking side effects. Do not configure per-preview payment webhooks for this scope. Full payment/reschedule tests remain outside CI smoke coverage.

## Deploy order and safety

CI rejects absent keys or keys that are not project preview keys before provisioning. It never falls back to production or the shared E2E deployment.

Convex invokes `--cmd` after provisioning but before deploying application code. `scripts/prepare-convex-preview.ts` uses that command only to inspect the newly provisioned preview's default environment variables and capture its actual URL. It does not run E2E. Credential-bearing CLI output stays in memory and never enters CI logs or artifacts. Safety failures print field names, not values.

The safety check validates required backend variables, test Stripe and Clerk key prefixes, the local return URL, approved Calendar/Drive IDs, and the external-account audit flag. Prefix/ID checks cannot prove OAuth permissions, email recipient safety, account pairing, or webhook destinations. The one-time account audit is still necessary.

Only after the check succeeds does Convex deploy functions and regenerate the API. CI then runs the full repository typecheck, including the endpoint return-type contract guard, and launches Playwright with the captured preview URL. An empty DB already uses the application's default booking settings. No booking seed or table wipe is needed. Customer state comes through the UI.

## Expiration and failures

Convex automatically deletes previews after 5 days on Free/Starter and 14 days on Professional/Business/Enterprise. The final preview remains until expiration after a PR closes. There is no PR-close cleanup job or management token. Each CI attempt replaces its named preview, so retention starts with the new deployment.

Closed-PR previews consume deployment quota until they expire. A quota or provisioning failure fails E2E explicitly. Do not recover by switching to a shared backend. If retention causes quota pressure, revisit early cleanup as a separate change.

Successful deployment records the preview name and URL in the job summary. Failed tests upload the Playwright report and traces for 7 days. A failed deployment or safety check prevents tests from starting. GitHub cancellation or a failed setup can leave an unused preview, which Convex expiration removes.

Production deployment conditions and commands remain unchanged. Both `convex/env.ts` and `src/env.ts` remain unchanged. CI has its own pre-deploy validation and does not import either application's environment loader.
