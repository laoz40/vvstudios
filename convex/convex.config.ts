import { defineApp } from "convex/server";
import migrations from "@convex-dev/migrations/convex.config.js";
import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";

const app = defineApp();

app.use(rateLimiter);

app.use(migrations);

export default app;
