import { v } from "convex/values";
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
		requirePermission(ctx, "update:editor-access")
			.andThen(() => loadEmployeeRoster(ctx))
			.match(tupleOk, tupleErr)
});

export const updateEmployeeNotes = mutation({
	args: { tokenIdentifier: v.string(), notes: v.string() },
	handler: (ctx, args) =>
		requirePermission(ctx, "update:editor-access")
			.andThen(() => saveEmployeeNotes(ctx, args.tokenIdentifier, args.notes))
			.match(tupleOk, tupleErr)
});

export const updateEmployeeAccess = mutation({
	args: { tokenIdentifier: v.string(), isActive: v.boolean() },
	handler: (ctx, args) =>
		requirePermission(ctx, "update:editor-access")
			.andThen(() => saveEmployeeAccess(ctx, args.tokenIdentifier, args.isActive))
			.match(tupleOk, tupleErr)
});
