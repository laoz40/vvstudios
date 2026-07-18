/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

export function createConvexTest() {
	return convexTest(schema, modules);
}
