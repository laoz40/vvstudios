import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";

// The ok payload of the query's [error, data] Result tuple; null while loading or on failure.
export type DriveDialogStatus = NonNullable<
	FunctionReturnType<typeof api.sessions.getDriveStatus>[1]
>;
