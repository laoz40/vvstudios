import { RuleTester } from "oxlint/plugins-dev";

import { noTryPromiseRethrowRule } from "./no-trypromise-rethrow.ts";

const tester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

tester.run("neverthrow/no-trypromise-rethrow", noTryPromiseRethrowRule, {
	valid: [
		`tryPromise({
      try: () => fetch("https://example.com"),
      catch: (cause) => ({ reason: "FETCH_FAILED" as const, cause })
    });`,
		`tryPromise({
      try: () => stripe.invoices.create({}),
      catch: () => ({ reason: "STRIPE_FAILED" as const })
    });`
	],
	invalid: [
		{
			code: `tryPromise({
        try: () => fetch("https://example.com"),
        catch: (cause) => {
          throw cause;
        }
      });`,
			errors: [{ messageId: "rethrow" }]
		},
		{
			code: `tryPromise({
        try: () => work(),
        catch: (error): never => {
          throw error;
        }
      });`,
			errors: [{ messageId: "rethrow" }]
		},
	]
});
