import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { mutation, query } from "#convex/_generated/server";
import {
	listEmployees as listEmployeesForAdmin,
	updateEmployeeAccessForAdmin,
	updateEmployeeNotesForAdmin
} from "#convex/services/employees/employeeManagement";

export const listEmployees = query({
	args: {},
	handler: (ctx) => listEmployeesForAdmin(ctx).match(tupleOk, tupleErr)
});

export const updateEmployeeNotes = mutation({
	args: { tokenIdentifier: v.string(), notes: v.string() },
	handler: (ctx, args) => updateEmployeeNotesForAdmin(ctx, args).match(tupleOk, tupleErr)
});

export const updateEmployeeAccess = mutation({
	args: { tokenIdentifier: v.string(), isActive: v.boolean() },
	handler: (ctx, args) => updateEmployeeAccessForAdmin(ctx, args).match(tupleOk, tupleErr)
});
