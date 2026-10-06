# CI failure triage

Use this recipe for failed GitHub Actions checks. Keep investigation read-only until the failure is classified.

## Identify the exact run

Read the PR's current head and checks:

```bash
gh pr view PR_NUMBER --json headRefOid,baseRefName,statusCheckRollup
```

Compare the notification SHA with the current head and the run's `headSha`. A failure on an older commit does not describe the current branch. Record the run ID, attempt, failed job ID, and checked-out merge commit. Confirm which step failed before treating an installation or deployment failure as a test failure.

## Read the failure evidence

Store evidence under `tmp/verify-vvstudios/ci-RUN_ID-attempt-ATTEMPT/`. Replace the placeholders in these commands with the observed IDs and that directory.

For a completed run, use `gh run view RUN_ID --log-failed`. If the failed job has finished but the overall run is still active, fetch that job directly:

```bash
gh api --allow-escape-sequences repos/laoz40/vvstudios/actions/jobs/JOB_ID/logs > EVIDENCE_DIR/job.log
```

For a browser failure, download the uploaded report after its upload step finishes:

```bash
gh run download RUN_ID --name playwright-report --dir EVIDENCE_DIR
```

Inspect `error-context.md` and `trace.zip` under the downloaded `test-results/`. Read console errors and visible notifications around the failed action. A missing payment modal is a symptom, not a diagnosis. An error inside the trace can identify the failed Convex operation even when the terminal output cannot.

## Check the backend when needed

Identify the E2E deployment from the job's deployment output and frontend URL. Confirm both refer to the same deployment before querying it. Use bounded reads of recent logs:

```bash
timeout 15s bunx convex logs --deployment DEPLOYMENT_NAME --history 100 --jsonl > EVIDENCE_DIR/convex.jsonl 2> EVIDENCE_DIR/convex.stderr
```

The timeout bounds the log stream; its timeout exit code alone is not a backend failure. Correlate request IDs, operation names, and UTC timestamps with the trace. Domain errors can return normally without a server exception.

For suspected stale bookings, use an existing query or a bounded read-only query to inspect the exact slot and record. Distinguish an active checkout from an orphan. A test email or missing Stripe ID alone is not enough to authorize cleanup. Check creation time, status, payment state, and Calendar linkage against the failed run. Keep raw evidence private and redact credentials, checkout secrets, and customer details before sharing excerpts.

## Choose the next action

- Retry a transient installation failure once, without changing product code.
- Fix a confirmed code failure instead of repeatedly rerunning it.
- Request approval for targeted shared-data cleanup. Use an existing cancellation or expiry operation only after checking its guards and side effects, then read back the result. Table wipes are not routine recovery.
- Before retrying E2E, check for other CI runs and local booking proofs using the same backend. Keep deployment and testing serial across PRs, not merely within each Playwright run.
- Use the PR watcher for subsequent updates. Before reporting success, confirm that checks passed on the current head. Local tests against an existing backend do not prove that CI deployed the same code.

Finish with the tested SHA, failure category, evidence supporting the diagnosis, action taken, and remaining uncertainty.
