import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const serverEnv = createEnv({
  server: {
    SERVER_URL: z.url().optional(),
    RESEND_API_KEY: z.string().min(1),
    RESEND_FROM_EMAIL: z.email().min(1),
  },

  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
