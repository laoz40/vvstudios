import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { mutation, query } from "#convex/_generated/server";
import {
	listEmployeesService,
	updateEmployeeAccessService,
	updateEmployeeNotesService
} from "#convex/services/employees";

export const listEmployees = query({
	args: {},
	handler: (ctx) => listEmployeesService(ctx).match(tupleOk, tupleErr)
});

export const updateEmployeeNotes = mutation({
	args: { tokenIdentifier: v.string(), notes: v.string() },
	handler: (ctx, args) => updateEmployeeNotesService(ctx, args).match(tupleOk, tupleErr)
});

export const updateEmployeeAccess = mutation({
	args: { tokenIdentifier: v.string(), isActive: v.boolean() },
	handler: (ctx, args) => updateEmployeeAccessService(ctx, args).match(tupleOk, tupleErr)
});
