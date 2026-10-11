import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import { mutation, query } from "#convex/_generated/server";
import { requirePermission } from "#convex/shared/services/auth";
import {
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

export const updateEmployeeNotes = mutation({
	args: { tokenIdentifier: v.string(), notes: v.string() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			yield* requirePermission(ctx, "update:editor-access");
			const result = yield* saveEmployeeNotes(ctx, args.tokenIdentifier, args.notes);

			return ok(result);
		}).match(tupleOk, tupleErr)
});

export const updateEmployeeAccess = mutation({
	args: { tokenIdentifier: v.string(), isActive: v.boolean() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			yield* requirePermission(ctx, "update:editor-access");
			const result = yield* saveEmployeeAccess(ctx, args.tokenIdentifier, args.isActive);

			return ok(result);
		}).match(tupleOk, tupleErr)
});
