import { ok, safeTry } from "neverthrow";
import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { mutation, query } from "#convex/_generated/server";
import { requirePermission } from "#convex/shared/services/auth";
import {
	loadEditorActiveJobs,
	loadEmployeeRoster,
	saveEmployeeAccess,
	saveEmployeeNotes
} from "#convex/employees/services/employeeManagement";

export const listEmployees = query({
	args: {},
	handler: (ctx) =>
		safeTry(async function* () {
			yield* requirePermission(ctx, "update:editor-access");
			const employees = yield* loadEmployeeRoster(ctx);

			return ok(employees);
		}).match(tupleOk, tupleErr)
});

export const listActiveJobs = query({
	args: { tokenIdentifier: v.string() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			yield* requirePermission(ctx, "update:editor-access");
			const activeJobs = yield* loadEditorActiveJobs(ctx, args.tokenIdentifier);

			return ok(activeJobs);
		}).match(tupleOk, tupleErr)
});

export const updateEmployeeNotes = mutation({
	args: { tokenIdentifier: v.string(), notes: v.string() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			yield* requirePermission(ctx, "update:editor-access");
			const notes = yield* saveEmployeeNotes(ctx, args.tokenIdentifier, args.notes);

			return ok(notes);
		}).match(tupleOk, tupleErr)
});

export const updateEmployeeAccess = mutation({
	args: { tokenIdentifier: v.string(), isActive: v.boolean() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			yield* requirePermission(ctx, "update:editor-access");
			const access = yield* saveEmployeeAccess(ctx, args.tokenIdentifier, args.isActive);

			return ok(access);
		}).match(tupleOk, tupleErr)
});
