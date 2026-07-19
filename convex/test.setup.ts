/// <reference types="vite/client" />

import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

export function createConvexTest() {
	const testClient = convexTest(schema, modules);
	rateLimiterTest.register(testClient);
	return testClient;
}
