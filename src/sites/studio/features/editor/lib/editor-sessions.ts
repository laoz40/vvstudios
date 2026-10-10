import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";

export type EditorSession = FunctionReturnType<
	typeof api.sessions.admin.listEditorSessions
>["page"][number];
